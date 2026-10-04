//! Tableau de bord : la page exportée est autonome, ses données sont celles du run,
//! et aucune barre du holdout verrouillé n'y figure.

mod common;

use evmc::pipeline::run_all;
use evmc::report::dashboard;

#[test]
fn exported_page_is_self_contained_and_respects_the_holdout() {
    let dir = common::tmp_dir("dashboard");
    let cfg = common::test_cfg(&dir);
    let series = common::default_series(3200, 51);
    let ctx = common::ctx(cfg.clone(), series);
    let out = common::in_pool(2, || run_all(&ctx).unwrap());
    let data = dashboard::build_data(&ctx, &out.manifest).unwrap();
    let (e, d) = (ctx.split.eval_start as u64, ctx.split.holdout_start as u64);

    // Barres : jusqu'au début du holdout, pas au-delà.
    assert_eq!(data["bars"]["n"].as_u64().unwrap(), d);
    for k in ["ts", "open", "high", "low", "close"] {
        // 8 octets par barre, encodés en base64.
        assert_eq!(data["bars"][k].as_str().unwrap().len() as u64, (d * 8).div_ceil(3) * 4, "{k}");
    }
    // Origines : toute la zone notée, dans l'ordre.
    let origins: Vec<u64> = data["fc"]["origins"].as_array().unwrap().iter().map(|v| v.as_u64().unwrap()).collect();
    assert_eq!(origins.len() as u64, d - e);
    assert_eq!((origins[0], *origins.last().unwrap()), (e, d - 1));
    assert_eq!(data["fc"]["stride"].as_u64().unwrap(), 1);
    // Modèles à distribution : un bloc chacun, de la bonne taille (5 quantiles en f32 par ligne).
    let n_h = cfg.horizons.grid.len() as u64;
    let models = data["models"].as_array().unwrap();
    assert_eq!(models.len(), cfg.models.enabled.len());
    let mut n_dist = 0;
    for m in models {
        let id = m["id"].as_str().unwrap();
        let blk = &data["fc"]["models"][id];
        if m["dist"].as_bool().unwrap() {
            n_dist += 1;
            let q = blk["q"].as_str().unwrap();
            // log-rendements en entiers 16 bits, probabilités en entiers 16 bits non signés
            assert_eq!(q.len() as u64, ((d - e) * n_h * 5 * 2).div_ceil(3) * 4, "{id}");
            assert_eq!(blk["p"].as_str().unwrap().len() as u64, ((d - e) * n_h * 2).div_ceil(3) * 4, "{id}");
        } else {
            assert!(blk.is_null(), "{id} ne devrait pas avoir d'éventail");
        }
    }
    assert_eq!(n_dist, 6);
    assert!(!data["models"].as_array().unwrap().iter().any(|m| m["id"] == "b1_coin" && m["dist"] == true));
    // Métriques : colonnes de même longueur, valeurs finies.
    let mx = &data["metrics"];
    let n = mx["v"].as_array().unwrap().len();
    assert!(n > 500);
    for k in ["m", "b", "h", "k", "p", "lo", "hi", "sig", "bl", "hac", "n"] {
        assert_eq!(mx[k].as_array().unwrap().len(), n, "{k}");
    }
    assert!(mx["v"].as_array().unwrap().iter().all(|v| v.as_f64().is_some_and(|x| x.is_finite())));
    assert!(data["folds"]["v"].as_array().unwrap().len() > 100);
    assert!(data["exc"]["v"].as_array().unwrap().len() >= 60 * n_h as usize);
    assert!(data["rel"]["p"].as_array().unwrap().len() >= 10);
    assert_eq!(data["meta"]["holdout_opened"], false);
    assert_eq!(data["meta"]["run_id"].as_str().unwrap(), ctx.run_id);

    // Page autonome : un document complet, données injectées une seule fois, trois blocs de script.
    let files = dashboard::export(&ctx, &out.manifest, true).unwrap();
    assert_eq!(files.len(), 2);
    let page = std::fs::read_to_string(&files[0]).unwrap();
    let fragment = std::fs::read_to_string(&files[1]).unwrap();
    assert!(page.starts_with("<!doctype html>") && page.contains("<meta charset=\"utf-8\">"));
    assert!(!fragment.contains("<!doctype") && !fragment.contains("<body"));
    for p in [&page, &fragment] {
        assert!(!p.contains("{{EVMC_DATA}}"));
        assert_eq!(p.matches("</script>").count(), 3);
        assert!(p.contains(&ctx.run_id));
        // Aucune dépendance de script externe : la page fonctionne hors ligne.
        assert!(!p.contains("<script src="));
    }
    // Les données relues depuis la page sont celles qui ont été construites.
    let start = page.find("id=\"evmc-data\">").unwrap() + "id=\"evmc-data\">".len();
    let end = start + page[start..].find("</script>").unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&page[start..end]).unwrap();
    assert_eq!(dashboard::data_fingerprint(&parsed), dashboard::data_fingerprint(&data));
    std::fs::remove_dir_all(dir).ok();
}
