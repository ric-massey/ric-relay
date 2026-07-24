# Evidence and Instrument Audit — 23 July 2026

## Bottom line

The current page is a thoughtful **exploratory synthesis**, but its five 0–100 columns do not yet form a calibrated measurement instrument. The largest remaining error is not missing literature. It is that several cells use evidence that measures a different construct from the column where it appears.

The current v5 ranking should therefore be retained only as a transparent legacy model. It should not be “improved” by swapping in a few new percentages while keeping the same structure. The next valid step is to define the estimand and redesign the criteria first, then rescore.

## What the audit found

### 1. “Danger in quitting” is not consistently measuring danger

The column definition says it measures whether stopping can physically kill someone. Several supporting studies instead measure **how common or unpleasant withdrawal is**:

- The caffeine source reports headache and functional impairment after abstinence. It establishes a real withdrawal syndrome, but not a medically dangerous one.
- The cannabis meta-analysis estimates prevalence of cannabis withdrawal syndrome. It does not estimate death or severe medical complications from stopping; clinical reviews describe cannabis withdrawal as generally not life-threatening.
- The tobacco and non-combustible nicotine notes explicitly say stopping is not physically dangerous, yet the scores are 40 and 35.
- Cocaine and methamphetamine withdrawal can involve severe depression, agitation, psychosis, and suicide risk, but that is a different construct from direct physiologic lethality.

Alcohol and benzodiazepines are the two strongest criterion-aligned rows. The 2025 joint benzodiazepine guideline says physical dependence is expected with ongoing regular use, is distinct from benzodiazepine use disorder, and abrupt reduction can produce life-threatening seizures or delirium.

**Required change:** remove withdrawal from the additive harm score. Represent two separate modifiers:

1. probability of physical dependence under a stated exposure pattern; and
2. medical hazard of abrupt cessation **conditional on dependence**.

The second is better presented as an ordinal safety flag than a 0–100 continuous score.

### 2. “Getting hooked” combines different questions

The column mixes:

- transition from first use to a use disorder;
- current or lifetime prevalence among users;
- physical dependence during prescribed use;
- speed of onset;
- intensity of reinforcement; and
- an author-assigned overall impression.

Those quantities are not interchangeable. Benzodiazepines show the problem clearly: the joint guideline cites an estimate that only 1.5% of people who use benzodiazepines meet criteria for benzodiazepine use disorder, while physical dependence is much more common and can be expected with regular use. A score of 55 cannot honestly stand for both facts.

**Required change:** use one declared estimand, such as “probability of DSM/ICD substance use disorder within five years of first nonmedical use,” and keep physical dependence separate.

### 3. “One bad night” is two constructs hidden in one number

The acute column combines:

- intrinsic medical toxicity and lethal margin;
- psychiatric destabilization;
- impaired judgment and accident risk;
- duration of intoxication;
- route and dose;
- adulteration and supply uncertainty; and
- setting and supervision.

A safety ratio can support the first item, but not the others. This is why a lethal-dose model places LSD near zero while the page assigns 45 for psychological and behavioral reasons. Both can be defensible, but they are not the same variable.

The psilocybin score also uses a selected denominator: the Carbonaro survey recruited people describing their most difficult psilocybin experience. Eleven percent of that selected group reporting physical risk is not an 11% risk per psilocybin episode or per user.

**Required change:** split acute harm into:

- **acute medical harm per episode**, and
- **acute behavioral/psychiatric harm per episode**.

### 4. Some evidence is in the wrong time horizon

The cocaine “damage to your body” score is supported by a study finding a 23.7-fold increase in myocardial-infarction onset in the first hour after cocaine use. That is evidence for an **acute medical event**, not a chronic-organ-damage rate.

**Required change:** move that evidence to acute medical harm. Chronic harm needs longitudinal morbidity, mortality, or health-loss evidence under a defined pattern of use.

### 5. Harm to others mixes per-user and population burden

The column combines UK expert-panel scores, US annual death totals, author judgments, violence, family harm, accidents, and public cost. The tobacco estimate is a population total affected by prevalence; several other rows are intended as per-user judgments. These cannot share a common additive scale without a denominator.

**Required change:** maintain two distinct outputs:

- external harm per 1,000 user-years at a specified pattern; and
- total population burden in a specified region and year.

Never put both in the same column.

### 6. Dependence is partly a cause of exposure, not merely another outcome

The current additive model counts dependence beside acute and chronic outcomes. But dependence raises frequency and duration of exposure, which then causes more acute and chronic harm. Withdrawal is also conditional on repeated exposure and dependence. Adding all of them as peer outcomes can count the same causal pathway more than once.

**Required change:** treat dependence, route, co-use, and supply as **risk modifiers** in a causal model. Keep the outcome score limited to non-overlapping outcomes.

### 7. The rows do not describe homogeneous interventions

“Illicit opioids” combines heroin, illicit fentanyl, and counterfeit pills. “Cocaine” combines powder and crack. “Benzodiazepines” combines agents with different half-lives and prescribed and nonmedical use. The score can change more from formulation, route, and market than from the drug label.

**Required change:** define each row as a scenario, not merely a molecule or class. At minimum specify formulation, route, dose range, frequency, geography/year, and whether supply is pharmaceutical or illicit.

## Evidence that can improve the current page now

These findings improve accuracy immediately, even before a full rescore:

1. **Benzodiazepines:** explicitly distinguish use disorder from physical dependence. The current “getting hooked” score should be marked construct-invalid rather than treated as a quantitative estimate.
2. **Caffeine and cannabis withdrawal:** reclassify the cited studies as evidence of prevalence/severity, not medical danger.
3. **Tobacco and non-combustible nicotine withdrawal:** the current 40/35 values contradict the stated definition and should not remain in a medical-danger composite.
4. **Cocaine myocardial-infarction evidence:** move it from chronic bodily damage to acute medical harm.
5. **Psilocybin acute evidence:** label the Carbonaro figure as conditional on selection for a difficult experience, not a population or episode rate.
6. **All 0–100 values:** state that the evidence may support ordering or direction while the distance between numbers remains uncalibrated.

The attached `evidence-audit.csv` applies this review to all 65 cells.

## Proposed v6 architecture

### First define three separate questions

| View | Estimand | Appropriate output |
|---|---|---|
| One episode | Serious acute outcomes per 100,000 episodes at a specified dose, route, setting, and supply | Two rates/bands: medical and behavioral/psychiatric |
| Regular use | Health loss per 1,000 user-years at a specified frequency and duration | Chronic morbidity/mortality, plus separate dependence and withdrawal modifiers |
| Population burden | Total harm in a named region and year | Deaths, DALYs, victim harms, and economic cost; prevalence explicitly included |

There should be no default “overall” rank that silently mixes these three questions.

### Outcome domains

1. **Acute medical harm** — overdose, cardiovascular event, hyperthermia, seizure, poisoning, or other serious medical event per episode.
2. **Acute behavioral/psychiatric harm** — serious accident, violence, self-harm, panic/psychosis requiring care, or dangerous disorientation per episode.
3. **Chronic physical health loss** — morbidity and mortality per user-year at the stated pattern.
4. **Chronic psychiatric/cognitive health loss** — persistent psychiatric or cognitive morbidity per user-year.
5. **External harm per user-year** — victim injury, family harm, impaired-driving harm, and other externalities, with a consistent denominator.

These should be checked for overlap before any additive score is permitted.

### Context and causal modifiers

- probability of substance use disorder within the defined exposure window;
- probability of physical dependence at the defined frequency/duration;
- withdrawal medical hazard conditional on dependence;
- dose and route;
- co-use;
- pharmaceutical versus illicit supply and adulteration uncertainty;
- user vulnerability and setting.

Modifiers should change exposure or outcome rates. They should not automatically become extra additive harm points.

### Scoring rules

- Start from natural units where possible: events, deaths, DALYs, or cases per defined exposure.
- Define explicit value functions before converting natural units to 0–100.
- Use `missing`, not zero, when evidence is absent.
- Use ordinal bands when evidence supports only order, not distance.
- Derive uncertainty from study intervals, model uncertainty, and independent expert disagreement—not fixed widths assigned by evidence grade.
- Use swing weighting only after the scale endpoints have real meanings.
- Publish results by view; an aggregate is optional and must disclose the value judgments required to create it.

### Development and validation protocol

1. Preregister intended use, target population, context, outcomes, and evidence rules.
2. Build systematic evidence dossiers for each scenario and domain.
3. Have a multidisciplinary panel score independently before discussion.
4. Report inter-rater reliability and the full disagreement distribution.
5. Reconcile only after recording initial judgments.
6. Test content validity: do the criteria fully and exclusively represent the stated construct?
7. Test construct validity against predefined hypotheses and external outcomes not used to build the model.
8. Replicate with a second panel and a different region/time period.
9. Freeze a version and prospectively test whether it predicts later outcomes.

## Recommended status language

> **Current status: legacy exploratory model (v5).** The page is reproducible and useful for visualizing how value judgments change a ranking. An evidence audit found construct mismatch and denominator inconsistency in several cells, so the displayed 0–100 values should not be interpreted as calibrated measurements. Model v6 is specified but not yet scored or validated.

## Sources used for this audit

- Joint Clinical Practice Guideline on Benzodiazepine Tapering, ASAM and partner societies, 2025.
- ASAM/AAAP Clinical Practice Guideline on the Management of Stimulant Use Disorder, 2024.
- Bahji et al., *JAMA Network Open* 2020, cannabis withdrawal meta-analysis.
- Carbonaro et al., *Journal of Psychopharmacology* 2016, selected survey of challenging psilocybin experiences.
- Mittleman et al., *Circulation* 1999, acute myocardial-infarction triggering after cocaine.
- Nutt, King, and Phillips, *The Lancet* 2010, UK drug-harm MCDA.
- Crépault et al., *Journal of Psychopharmacology* 2026, Canadian drug-harm MCDA.
- ISPOR MCDA Emerging Good Practices Task Force, Report 2, 2016.
- COSMIN content-validity methodology and FDA outcome-measure development guidance.

This audit improves the conceptual and evidential honesty of the project. It does **not** make v6 a validated instrument; v6 remains a design specification until its evidence review, scoring, reliability, and validation work are completed.
