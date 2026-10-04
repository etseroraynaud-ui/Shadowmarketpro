// Empreinte du code source, injectée à la compilation : identifie la version
// du code dans le manifest, même sans commit git.
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn collect(dir: &Path, out: &mut Vec<PathBuf>) {
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                collect(&p, out);
            } else if p.extension().map(|x| x == "rs").unwrap_or(false) {
                out.push(p);
            }
        }
    }
}

fn fnv1a(h: &mut u64, bytes: &[u8]) {
    for b in bytes {
        *h ^= *b as u64;
        *h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
}

fn main() {
    let mut files = Vec::new();
    collect(Path::new("src"), &mut files);
    files.push(PathBuf::from("Cargo.toml"));
    files.push(PathBuf::from("build.rs"));
    files.sort();
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for f in &files {
        println!("cargo:rerun-if-changed={}", f.display());
        fnv1a(&mut h, f.to_string_lossy().as_bytes());
        if let Ok(b) = fs::read(f) {
            fnv1a(&mut h, &b);
        }
    }
    println!("cargo:rerun-if-changed=src");
    println!("cargo:rustc-env=EVMC_SRC_HASH={:016x}", h);

    let git = Command::new("git")
        .args(["rev-parse", "--short=12", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "nogit".to_string());
    println!("cargo:rustc-env=EVMC_GIT={}", git);

    let rustc = std::env::var("RUSTC").unwrap_or_else(|_| "rustc".into());
    let ver = Command::new(rustc)
        .arg("-V")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "unknown".into());
    println!("cargo:rustc-env=EVMC_RUSTC={}", ver);
    println!(
        "cargo:rustc-env=EVMC_TARGET={}",
        std::env::var("TARGET").unwrap_or_else(|_| "unknown".into())
    );
}
