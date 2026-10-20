# Additif n° 2 — contrôles de couverture en échec : analyse secondaire

Rédigé le 2026-10-20 et commité **avant d'avoir regardé le moindre résultat de l'étude d'événement,
de la grille ou des walk-forwards sur l'or, et avant l'audit des données du Nasdaq**. Complète
`futures-k-transfer-proxy.md` (commit `4fc13b9`) ; tout le reste est inchangé.

## Ce qui s'est passé

- Le script commité (`fce2de4`) appliquait par erreur aux substituts les seuils de couverture du
  protocole futures (1 % de bougies manquantes, 10 trous imprévus par an) au lieu de ceux de l'additif
  (2 %, 25). Le code est corrigé pour appliquer l'additif, rien d'autre ne change.
- Seul l'audit des données de l'or a été lu (section « Données » du rapport de développement). Avec
  les seuils de l'additif : bougies manquantes au plus 1,13 % par an (contrôle passé) ; trous imprévus
  de plus de 60 min : **31 en 2014** (6 à 10 les autres années), au-dessus de 25 : **contrôle en
  échec**. Cause, vérifiée bougie par bougie : de début mars à mi-avril 2014, la pause quotidienne du
  flux Dukascopy va de 17 h à 19 h (heure de New York) au lieu de 17 h – 18 h, soit 21 trous de 2 h,
  en plus des clôtures anticipées des jours fériés américains (7 à 9 par an).
- **La conclusion principale de l'or (substitut) est donc D**, selon la règle de l'additif. Le seuil
  n'est pas modifié.

## Analyse secondaire (fixée ici)

- Pour chaque substitut dont un contrôle de **couverture** échoue (bougies manquantes, trous
  imprévus), une analyse secondaire est rapportée : mêmes calculs (le script calcule toutes les étapes
  quel que soit le résultat des contrôles), mêmes critères C1 à C7, même règle A / B / C, en ignorant
  les seuls contrôles de couverture en échec ; la cause de l'échec est décrite.
- Un contrôle d'**intégrité** en échec (horodatages, cohérence OHLC, prix, mauvais ticks) donne D
  aussi en analyse secondaire.
- L'analyse secondaire n'est pas confirmatoire : la conclusion principale reste D. Les deux sont
  rapportées côte à côte, sans que l'une remplace l'autre.
- La même règle s'applique au Nasdaq si son audit, encore non lu, met en échec un contrôle de
  couverture.
