// Generates src/data/resources/bnb.ts from the B&B Step 1 checklist in
// /resources-src (gitignored, never committed). Titles only: no durations,
// no descriptions, nothing edition-specific is written out.
//
//   node scripts/gen-bnb.mjs [resources-src/bnb-checklist.pdf]
//
// Every checklist video must map to exactly one topic in src/data/topics.ts;
// the script fails loudly otherwise. Placements that were a judgment call are
// listed in REVIEW and exported as BNB_NEEDS_REVIEW for Omar to check.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { TOPICS, topicId } from '../src/data/topics.ts'

const file = process.argv[2] ?? 'resources-src/bnb-checklist.pdf'

/** Obvious typos in the checklist, fixed on the way in. */
const TYPOS = { 'Lug Physical Exam': 'Lung Physical Exam', 'Malignent Bone Tumors': 'Malignant Bone Tumors' }

/** system → topic → B&B video titles, in checklist order. */
const MAP = {
  Cardio: {
    'Cardiac anatomy & physiology': ['Cardiac Anatomy', 'Cardiac Physiology', 'CV Response to Exercise', 'Blood Flow Mechanics', 'Regulation of Blood Pressure'],
    'Cardiac cycle': ['PV Loops', 'Wiggers’ Diagram', 'Venous Pressure Tracings', 'Starling Curve'],
    'Ischemic heart disease': ['Cardiac Ischemia I', 'Cardiac Ischemia II', 'Atherosclerosis', 'STEMI', 'Unstable Angina/NSTEMI', 'Stable Angina'],
    EKGs: ['EKG Basics', 'High Yield EKGs'],
    Arrhythmias: ['Cardiac Action Potentials', 'AV and Bundle Branch Blocks', 'Atrial Fibrillation and Flutter', 'Paroxysmal supraventricular tachycardia', 'WPW'],
    'Antiarrhythmic drugs': ['Antiarrhythmic Drugs I', 'Antiarrhythmic Drugs II', 'Antiarrhythmic Drugs III'],
    'Heart sounds & murmurs': ['Heart Murmurs', 'Heart Sounds'],
    'Heart failure': ['Heart Failure Basics', 'Systolic and Diastolic Heart Failure', 'Acute Heart Failure', 'Chronic Heart Failure'],
    Cardiomyopathies: ['Restrictive Cardiomyopathy', 'Hypertrophic Cardiomyopathy'],
    'Congenital heart disease': ['Cardiac Embryology', 'Shunts', 'Cyanotic Congenital Heart Disease', 'Coarctation of the Aorta'],
    Hypertension: ['Hypertension', 'Secondary Hypertension', 'Antihypertensives I', 'Antihypertensives II'],
    'Valvular disease': ['Valve Disease'],
    'Infective endocarditis': ['Infective Endocarditis'],
    'Pericardial disease': ['Pericardial Disease', 'Cardiac Tumors'],
    'Shock & aortic disease': ['Shock', 'Aortic Disease'],
  },
  Resp: {
    'Lung development & anatomy': ['Pulmonary Embryology', 'Pulmonary Anatomy I', 'Pulmonary Anatomy II'],
    'Respiratory physiology': ['Pulmonary Physiology I', 'Pulmonary Physiology II', 'Ventilation and Perfusion', 'Dead Space'],
    'Oxygen & CO2 transport': ['Hemoglobin', 'Carbon Dioxide'],
    'Hypoxia & hypoxemia': ['Hypoxia', 'Hypoxemia'],
    'Pulmonary hypertension': ['Pulmonary Circulation', 'Pulmonary Hypertension'],
    'Lung exam & chest X-rays': ['Lung Physical Exam', 'Chest X-rays'],
    'Asthma & COPD': ['Pulmonary Function Tests', 'COPD', 'Asthma & Bronchiectasis', 'Treatment of COPD and Asthma'],
    'Interstitial lung disease': ['Restrictive Lung Disease', 'Sarcoidosis'],
    Pneumonia: ['Pneumonia I', 'Pneumonia II', 'Tuberculosis'],
    'Pleural disease': ['Pleural Disease'],
    'Lung cancer': ['Lung Cancer'],
    'PE & DVT': ['Deep Vein Thrombosis & Pulmonary Embolism'],
    'Sleep apnea & cystic fibrosis': ['Sleep Apnea', 'Cystic Fibrosis'],
  },
  Renal: {
    'Renal anatomy & physiology': ['Renal Embryology', 'Renal Anatomy', 'Renal Physiology I', 'Renal Physiology II'],
    'Nephron physiology': ['Nephron Physiology', 'Renal Endocrine Function'],
    'Acid–base': ['Acid Excretion', 'Acid-Base Principles', 'Respiratory Disorders', 'Metabolic Alkalosis', 'Renal Tubular Acidosis', 'Metabolic Acidosis', 'Acid Base Problems'],
    Electrolytes: ['Electrolyte Disorders', 'Sodium and Water Balance', 'Sodium Disorders'],
    'Glomerular disease': ['Glomerulonephritis Principles', 'Nephritic Syndrome', 'Nephrotic Syndrome', 'MPGN'],
    'AKI & CKD': ['Tubulointerstitial Disease', 'Renal Failure', 'Rhabdomyolysis'],
    Diuretics: ['Diuretics'],
    'Kidney stones': ['Kidney Stones'],
    'UTIs & cystic kidney disease': ['Urinary Tract Infections', 'Cystic Kidney Disease'],
    'Renal & bladder tumors': ['Renal and Bladder Tumors'],
  },
  GI: {
    'GI anatomy & embryology': ['Gastrointestinal Embryology', 'Gastrointestinal Anatomy', 'Gastrointestinal Blood Supply', 'Gastrointestinal Tract', 'Liver, Gallbladder, and Pancreas', 'Salivary Glands', 'Hernias'],
    'GI physiology': ['Gastrointestinal Secretions', 'Gastrointestinal Hormones', 'Exocrine Pancreas'],
    'Bile & bilirubin': ['Bile', 'Bilirubin'],
    'Esophagus & stomach': ['Esophageal Disorders', 'Gastric Disorders'],
    'Liver disease': ['Liver Disease', 'Cirrhosis', 'Liver Tumors', 'Wilson’s Disease and Hemochromatosis'],
    'Gallbladder & biliary disease': ['Gallstones', 'Biliary Disorders'],
    'Pancreatitis & pancreatic cancer': ['Acute Pancreatitis', 'Chronic Pancreatitis & Pancreatic Cancer'],
    Malabsorption: ['Malabsorption'],
    'Intestinal disorders': ['Intestinal Disorders', 'Carcinoid Tumors'],
    IBD: ['Inflammatory Bowel Disease'],
    'Colorectal cancer': ['Colon Cancer'],
    'GI pharmacology': ['Gastrointestinal Pharmacology'],
  },
  Endo: {
    Thyroid: ['Thyroid Anatomy & Physiology', 'Thyroid Hormone Synthesis & Labs', 'Hyperthyroidism', 'Hypothyroidism and Thyroiditis', 'Thyroid Cancer'],
    Adrenal: ['Adrenal Glands', "Cushing's Syndrome", 'Adrenal Insufficiency', 'Hyperaldosteronism', 'Adrenal Tumors', 'Congenital Adrenal Hyperplasia'],
    Diabetes: ['Insulin', 'Glucagon & Hypoglycemia', 'Type I Diabetes', 'Type II Diabetes', 'Insulin Medications', 'Treatment of Diabetes'],
    'Reproductive hormones': ['Reproductive Hormones', 'Male Reproductive Hormones', 'Female Reproductive Hormones', 'Contraceptives', 'Menstrual Cycle'],
    Amenorrhea: ['Primary Amenorrhea', 'Secondary Amenorrhea'],
    Pituitary: ['Pituitary Anatomy & Physiology', 'Pituitary Pathology'],
    'Calcium & parathyroid': ['Parathyroid Glands', 'Parathyroid Pathology'],
    'MEN syndromes': ['MEN Syndromes'],
    'Hormone signaling': ['Signaling Pathways'],
  },
  'Heme/Onc': {
    Coagulation: ['Coagulation', 'Platelet Activation'],
    'Bleeding & clotting disorders': ['Hypercoagulable States', 'Coagulopathies', 'Platelet Disorders'],
    'Anticoagulants & antiplatelets': ['Antiplatelet Drugs', 'Anticoagulants'],
    'Hemolytic anemias': ['Hemolysis Basics', 'Extrinsic Hemolysis', 'Intrinsic Hemolysis', 'Sickle Cell Anemia'],
    'Microcytic anemias': ['Microcytic Anemias', 'Thalassemias'],
    'Other anemias & blood groups': ['Other Anemias', 'Blood Groups'],
    Leukemias: ['Acute Leukemia', 'Chronic Leukemia'],
    Lymphomas: ['Hodgkin Lymphoma', 'Non-Hodgkin Lymphoma'],
    'Plasma cell disorders & amyloidosis': ['Plasma Cell Disorders', 'Amyloidosis'],
    'Myeloproliferative disorders': ['Myeloproliferative Disorders'],
    'Cancer drugs': ['Antimetabolites', 'Alkylating Agents', 'Antitumor Antibiotics', 'Microtubule Inhibitors', 'DNA Drugs', 'Other Cancer Drugs'],
    Porphyrias: ['Porphyrias'],
  },
  Neuro: {
    'Neurons & neurotransmitters': ['Cells of the Nervous System', 'Nerve Damage', 'Blood Brain Barrier', 'Neurotransmitters'],
    'Brain & spinal cord anatomy': ['Cerebral Cortex', 'Spinal Cord', 'Dermatomes and Reflexes', 'Ventricles and Sinuses'],
    'Spinal cord syndromes': ['Spinal Cord Syndromes'],
    'Brainstem & cranial nerves': ['Brainstem', 'Cranial Nerves', 'Auditory System', 'Vestibular System'],
    'Deep brain structures': ['Thalamus, Hypothalamus, Limbic System', 'Cerebellum', 'Basal Ganglia'],
    Stroke: ['Cerebral and Lacunar Strokes', 'Vertebrobasilar Stroke Syndromes', 'Management of TIA/Stroke'],
    'Aneurysms & intracranial bleeding': ['CNS Aneurysms', 'Intracranial Bleeding'],
    'Autonomic pharmacology': ['Autonomic Nervous System', 'ANS Drugs: Norepinephrine', 'ANS Drugs: Acetylcholine', 'Autonomic Receptors'],
    'Meningitis & CNS infections': ['Meningitis', 'HIV CNS Infections'],
    Seizures: ['Seizures'],
    Headache: ['Headaches'],
    'Dementia & delirium': ['Delirium and Dementia'],
    'Movement disorders': ['Parkinson’s, Huntington’s, and Movement Disorders'],
    'Demyelinating disease': ['Demyelinating Disease'],
    'Neuromuscular disorders': ['Neuromuscular Disorders'],
    'Brain tumors': ['Brain Tumors'],
    Neuroembryology: ['Neuroembryology'],
    'Eye & lens': ['Eye Anatomy', 'Eye Disorders', 'Lens', 'Glaucoma'],
    'Retina & optic nerve': ['The Retina', 'Retinal Disorders I', 'Retinal Disorders II', 'Optic Nerve'],
    'Eye movements & visual fields': ['Gaze Disorders', 'Visual Field Defects'],
  },
  Repro: {
    Embryology: ['Embryonic Genes', 'Embryogenesis', 'Germ Layers', 'Errors in Morphogenesis'],
    Teratogens: ['Teratogens I', 'Teratogens II'],
    'Pharyngeal arches': ['Pharyngeal Arches', 'Cleft Lip and Palate', 'Pharyngeal Pouches and Clefts'],
    'Sexual development': ['Genital Embryology', 'Disorders of Sexual Development', 'Hypogonadism'],
    Pregnancy: ['Spermatogenesis and Oogenesis', 'Placenta', 'Twins', 'Pregnancy', 'TORCH Infections'],
    'Pregnancy complications': ['Maternal-Fetal Disorders', 'Hypertension in Pregnancy', 'Placental Complications', 'Gestational Tumors'],
    'Uterus, cervix & vagina': ['Vaginal Cancer', 'Cervical Cancer', 'Endometrial Disorders', 'Endometriosis', 'Endometrial Cancer'],
    'Ovarian disease': ['Ovarian Cysts', 'Ovarian Epithelial Tumors', 'Ovarian Stromal Tumors', 'Ovarian Germ Cell Tumors'],
    Breast: ['Breast Tissue', 'Breast Disorders', 'Breast Carcinoma'],
    'Male reproductive disease': ['Penile Disorders', 'Scrotal Disorders', 'Testicular Cancer', 'Prostate'],
  },
  MSK: {
    'Upper limb': ['Shoulder and Elbow', 'Brachial Plexus', 'Wrist', 'Hand'],
    'Lower limb & back': ['Knee', 'Hip', 'Lumbosacral Plexus', 'Lumbar Radiculopathy'],
    'Muscle physiology': ['Skeletal Muscle', 'Cardiac Muscle', 'Smooth Muscle'],
    Bone: ['Bone', 'Bone Disorders', 'Osteoporosis', 'Osteoporosis Drugs'],
    'Bone tumors': ['Benign Bone Tumors', 'Malignant Bone Tumors'],
    'Arthritis & muscle disorders': ['Arthritis', 'Muscle Disorders', 'Common Musculoskeletal Conditions'],
  },
  Immuno: {
    'Innate immunity & complement': ['Innate Immunity', 'The Complement System'],
    'Adaptive immunity': ['T-cells', 'B-cells', 'Lymph Nodes and Spleen'],
    'Hypersensitivity & transplants': ['Hypersensitivity', 'Transplants'],
    Immunodeficiencies: ['Immune Deficiency Syndromes'],
    'Immunosuppressants & NSAIDs': ['Glucocorticoids and NSAIDs', 'Immunosuppressive Drugs'],
    'Lupus & connective tissue disease': ['Systemic Lupus Erythematosus', 'Scleroderma', 'Sjogren’s Syndrome'],
    'Rheumatoid & seronegative arthritis': ['Rheumatoid Arthritis', 'Seronegative Spondyloarthritis'],
    Vasculitis: ['Vasculitis'],
    'Gout & CPPD': ['Gout', 'Gout Drugs', 'CPPD'],
  },
  Micro: {
    'Bacterial basics': ['Bacteria', 'Shapes and Stains', 'Bacterial Culture', 'Special Growth Requirements', 'Virulence', 'Growth and Genetics', 'Bacterial Identification'],
    'Gram-positive bacteria': ['Staphylococci', 'Streptococci', 'Other Gram Positives'],
    'Gram-negative bacteria': ['Gram Negative Rods', 'Other Gram Negatives'],
    'Spirochetes, zoonoses & mycobacteria': ['Spirochetes', 'Zoonotic Infections', 'Mycobacteria'],
    Antibiotics: ['Penicillins', 'Beta Lactams', 'Sulfonamides', 'Protein Synthesis Inhibitors', 'Other Antibiotics'],
    Fungi: ['Fungal Pneumonias', 'Fungal Skin Infections', 'Opportunistic Fungal Infections', 'Antifungal Drugs'],
    Parasites: ['Malaria', 'Protozoa', 'Helminths'],
    Viruses: ['Virus Structures', 'DNA Viruses', 'Herpes Viruses', 'RNA Viruses'],
    'Hepatitis & HIV': ['Viral Hepatitis', 'HIV'],
    Antivirals: ['HIV Drugs', 'Antiviral Drugs'],
  },
  Psych: {
    'Psychology & defenses': ['Conditioning and Transference', 'Ego Defenses'],
    'Childhood disorders': ['Child Abuse and Neglect', 'Childhood Disorders', 'ADHD and Autism'],
    'Psychotic disorders': ['Cognitive Disorders', 'Psychosis', 'Psychotic Disorders'],
    'Mood & anxiety disorders': ['Mood Disorders', 'Anxiety Disorders'],
    'Personality, somatic & dissociative disorders': ['Dissociative Disorders', 'Somatic and Factitious Disorders', 'Personality Disorders'],
    'Eating & sleep disorders': ['Eating Disorders', 'Sleep Disorders'],
    'Substance use': ['Alcohol and CNS Depressants', 'Opioids', 'Stimulants', 'Other Drugs'],
    'Psychiatric drugs': ['Antidepressants', 'Lithium', 'Antipsychotics'],
  },
  Derm: {
    'Skin structure': ['Skin', 'Epithelial Cells'],
    'Skin disorders': ['Skin Disorders I', 'Skin Disorders II', 'Pigment Disorders', 'Vascular Lesions', 'Hypersensitivity Disorders'],
    'Skin infections & blistering': ['Skin Infections', 'Blistering Disorders'],
    'Skin cancer': ['Skin Cancer', 'Neurocutaneous Disorders'],
  },
  Pharm: {
    'Pharmacokinetics & dynamics': ['Enzymes', 'Enzyme Inhibitors', 'Dose-Response', 'Drug Elimination', 'Pharmacokinetics'],
    Anesthetics: ['Inhaled Anesthetics', 'Intravenous Anesthetics', 'Local Anesthetics', 'Neuromuscular Blockers'],
  },
  Biochem: {
    'DNA & nucleotides': ['DNA Structure', 'Purine Metabolism', 'Pyrimidine Metabolism'],
    'Molecular biology': ['DNA Replication', 'DNA Mutations', 'DNA Repair', 'Transcription', 'Translation'],
    'Lab techniques': ['PCR', 'Blotting', 'Flow Cytometry', 'ELISA', 'Microarrays and FISH'],
    'Cell biology': ['Cell Cycle', 'Cell Structure', 'Cytoskeleton', 'Connective Tissue'],
    'Carbohydrate metabolism': ['Glucose', 'Glycolysis', 'Gluconeogenesis', 'Glycogen', 'HMP Shunt', 'Fructose and Galactose'],
    'Energy metabolism': ['Pyruvate Dehydrogenase', 'TCA Cycle', 'Electron Transport Chain'],
    'Fatty acids & ketones': ['Fatty Acids', 'Ketone Bodies'],
    'Fed, fasting & ethanol': ['Ethanol Metabolism', 'Exercise and Starvation'],
    'Inborn errors of metabolism': ['Inborn Errors of Metabolism'],
    'Amino acids': ['Amino Acids', 'Phenylalanine and Tyrosine', 'Other Amino Acids', 'Ammonia'],
    Vitamins: ['B Vitamins', 'B12 and Folate', 'Other Vitamins'],
    Lipids: ['Lipid Metabolism', 'Hyperlipidemia', 'Lipid Drugs'],
    'Lysosomal storage diseases': ['Lysosomal Storage Diseases'],
  },
  Genetics: {
    'Genetic principles': ['Genetic Principles', 'Gene Mapping', 'Meiosis', 'Hardy-Weinberg Law', 'Pedigrees', 'Imprinting'],
    'Chromosomal & genetic disorders': ['Down Syndrome', 'Trisomies', 'Muscular Dystrophy', 'Trinucleotide Repeat Disorders', 'Deletion Syndromes', 'Turner and Klinefelter Syndromes'],
  },
  Pathology: {
    'Cell injury & death': ['Cellular Adaptations', 'Cell Injury', 'Free Radicals', 'Apoptosis', 'Necrosis', 'Pathologic Calcification'],
    'Inflammation & repair': ['Inflammation Principles', 'Acute and Chronic Inflammation', 'Granulomatous Inflammation', 'Wound Healing and Scar'],
    Neoplasia: ['Neoplasia'],
  },
  Biostats: {
    Biostatistics: ['Statistics', 'Hypothesis Testing', 'Tests of Significance', 'Correlations'],
    'Study designs & risk': ['Study Designs', 'Risk Quantification'],
    'Diagnostic tests': ['Sensitivity and Specificity', 'Predictive Value', 'Diagnostic Tests'],
    'Bias & clinical trials': ['Bias', 'Clinical Trials', 'Evidence-based Medicine'],
  },
  Behavioral: {
    Ethics: ['Ethics Principles', 'Informed Consent', 'Confidentiality', 'Decision-Making Capacity'],
    'Public health & safety': ['Public Health', 'Quality and Safety'],
    'Life cycle': ['The Healthy Patient', 'Geriatrics', 'Pediatrics'],
  },
}

/** Placements that were a judgment call (title → why). Shown to Omar for review. */
const REVIEW = {
  'Hemoglobin': 'B&B files it under Pulmonary; placed in Resp “Oxygen & CO2 transport”, could be Heme/Onc.',
  'Cognitive Disorders': 'Placed in Psych “Psychotic disorders”; could also be Neuro “Dementia & delirium”.',
  'Sleep Disorders': 'Psych “Eating & sleep disorders”; Sleep apnea stays in Resp.',
  'Neurocutaneous Disorders': 'B&B files it under Dermatology; placed in Derm “Skin cancer”, could be Neuro or Genetics.',
  'Connective Tissue': 'From B&B Cell Biology; placed in Biochem “Cell biology”.',
  'Cardiac Muscle': 'From B&B Musculoskeletal; placed in MSK “Muscle physiology”, could be Cardio.',
  'Glucocorticoids and NSAIDs': 'From B&B Immunology; placed in Immuno “Immunosuppressants & NSAIDs”.',
  'Lipid Drugs': 'From B&B Biochemistry; placed in Biochem “Lipids”, could be Cardio.',
  'Vasculitis': 'B&B files it under Immunology; placed in Immuno “Vasculitis”. First Aid puts it in Cardio.',
  'Reproductive Hormones': 'B&B Endocrinology “Reproductive” section kept in Endo; Repro system covers anatomy and disease.',
  'Pediatrics': 'B&B Behavioral Science video; placed in Behavioral “Life cycle”.',
  'Geriatrics': 'B&B Behavioral Science video; placed in Behavioral “Life cycle”.',
  'Tuberculosis': 'Placed in Resp “Pneumonia”; Micro “Spirochetes, zoonoses & mycobacteria” also covers mycobacteria.',
  'Neuromuscular Blockers': 'B&B Anesthesia; placed in Pharm “Anesthetics”.',
  'HIV CNS Infections': 'Placed in Neuro “Meningitis & CNS infections”.',
  'Hernias': 'Placed in GI “GI anatomy & embryology”.',
  'Lung Physical Exam': 'Checklist typo “Lug Physical Exam” corrected.',
  'Malignant Bone Tumors': 'Checklist typo “Malignent Bone Tumors” corrected.',
}

// ── Parse the checklist ───────────────────────────────────────────────────
const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' })
const checklist = []
let subject
for (const raw of text.split('\n')) {
  const line = raw.trim()
  let m
  if ((m = /^([A-Z][A-Za-z/ ]+) \((\d+) videos?;/.exec(line))) {
    subject = { name: m[1].trim(), claimed: Number(m[2]), videos: [] }
    checklist.push(subject)
  } else if (/^□\s*[IVX]+\.\s/.test(line)) {
    // section heading: structure only
  } else if ((m = /^□\s*(.+?) \(\d.*\)$/.exec(line)) && subject) {
    const t = m[1].replace(/\s+/g, ' ').trim()
    subject.videos.push(TYPOS[t] ?? t)
  }
}

// ── Map and validate ─────────────────────────────────────────────────────
const where = new Map()
for (const [system, topics] of Object.entries(MAP)) {
  if (!TOPICS[system]) throw new Error(`Unknown system ${system}`)
  for (const [topic, videos] of Object.entries(topics)) {
    if (!TOPICS[system].includes(topic)) throw new Error(`Unknown topic ${system} / ${topic}`)
    for (const v of videos) {
      if (where.has(v)) throw new Error(`Mapped twice: ${v}`)
      where.set(v, { system, topic })
    }
  }
}

const items = []
const unmapped = []
const seen = new Set()
for (const s of checklist) {
  for (const title of s.videos) {
    const w = where.get(title)
    if (!w) {
      unmapped.push(`${s.name}: ${title}`)
      continue
    }
    seen.add(title)
    items.push({ id: `bnb-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, title, system: w.system, topicIds: [topicId(w.system, w.topic)] })
  }
}
const extra = [...where.keys()].filter((v) => !seen.has(v))
if (extra.length) throw new Error(`In MAP but not in the checklist: ${extra.join(', ')}`)
const ids = new Set(items.map((i) => i.id))
if (ids.size !== items.length) throw new Error('Duplicate ids')

const emptyTopics = Object.entries(TOPICS).flatMap(([sys, names]) =>
  names.filter((n) => !(MAP[sys] && MAP[sys][n])).map((n) => `${sys} / ${n}`))

const listed = checklist.map((s) => [s.name, s.videos.length, s.claimed]).filter(([, a, b]) => a !== b)
const review = Object.entries(REVIEW).map(([title, note]) => `${title}: ${note}`)

const out = `// GENERATED by scripts/gen-bnb.mjs from the B&B Step 1 checklist. Do not edit by hand:
// change the MAP in the script and re-run it. Titles only (no durations, no numbers).
import type { ResourceItem } from './types'

export const BNB: ResourceItem[] = [
${items.map((i) => `  { id: ${JSON.stringify(i.id)}, title: ${JSON.stringify(i.title)}, system: ${JSON.stringify(i.system)}, topicIds: ${JSON.stringify(i.topicIds)} },`).join('\n')}
]

/** Placements that were a judgment call, plus anything that didn't map. TODO(placeholder): Omar to review. */
export const BNB_NEEDS_REVIEW: string[] = ${JSON.stringify([...unmapped.map((u) => `Unmapped: ${u}`), ...review], null, 2)}
`
writeFileSync('src/data/resources/bnb.ts', out)
console.log(`${items.length} videos mapped to ${new Set(items.map((i) => i.topicIds[0])).size} topics; ${unmapped.length} unmapped; ${review.length} for review.`)
if (emptyTopics.length) console.log(`Topics with no B&B video: ${emptyTopics.join('; ')}`)
if (listed.length) console.log(`Checklist lists fewer videos than its header says: ${listed.map(([n, a, b]) => `${n} ${a}/${b}`).join(', ')}`)
