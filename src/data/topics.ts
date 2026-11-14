// The topic map: systems → topics. The plan is built from these, never from
// resource units (no video numbers, no page numbers). Resources only say
// HOW a topic is studied (see src/data/resources/).
//
// TODO(placeholder): Omar to review. Topic names and grouping were drafted from
// the B&B Step 1 checklist structure so every B&B video lands in exactly one topic.
// Self-contained on purpose: scripts/gen-bnb.mjs imports this file directly.

export interface SystemDef {
  /** Short name used everywhere: chips, task titles, accuracy. */
  id: string
  /** Longer name for places with room. */
  name: string
}

/**
 * Recommended order when the app suggests the next system (not-started first, in this order).
 * TODO(placeholder): order for students on rotations; this one starts with organ systems.
 */
export const SYSTEMS: SystemDef[] = [
  { id: 'Cardio', name: 'Cardiology' },
  { id: 'Resp', name: 'Pulmonary' },
  { id: 'Renal', name: 'Renal' },
  { id: 'GI', name: 'Gastroenterology' },
  { id: 'Endo', name: 'Endocrinology' },
  { id: 'Heme/Onc', name: 'Hematology & oncology' },
  { id: 'Neuro', name: 'Neurology & eye' },
  { id: 'Repro', name: 'Reproductive' },
  { id: 'MSK', name: 'Musculoskeletal' },
  { id: 'Immuno', name: 'Immunology & rheumatology' },
  { id: 'Micro', name: 'Microbiology' },
  { id: 'Psych', name: 'Psychiatry' },
  { id: 'Derm', name: 'Dermatology' },
  { id: 'Pharm', name: 'General pharmacology' },
  { id: 'Biochem', name: 'Biochemistry & cell biology' },
  { id: 'Genetics', name: 'Genetics' },
  { id: 'Pathology', name: 'General pathology' },
  { id: 'Biostats', name: 'Biostatistics & epidemiology' },
  { id: 'Behavioral', name: 'Behavioral science & ethics' },
]

/** Topics per system, in study order. */
export const TOPICS: Record<string, string[]> = {
  Cardio: [
    'Cardiac anatomy & physiology', 'Cardiac cycle', 'Ischemic heart disease', 'EKGs', 'Arrhythmias',
    'Antiarrhythmic drugs', 'Heart sounds & murmurs', 'Heart failure', 'Cardiomyopathies', 'Congenital heart disease',
    'Hypertension', 'Valvular disease', 'Infective endocarditis', 'Pericardial disease', 'Shock & aortic disease',
  ],
  Resp: [
    'Lung development & anatomy', 'Respiratory physiology', 'Oxygen & CO2 transport', 'Hypoxia & hypoxemia',
    'Pulmonary hypertension', 'Lung exam & chest X-rays', 'Asthma & COPD', 'Interstitial lung disease', 'Pneumonia',
    'Pleural disease', 'Lung cancer', 'PE & DVT', 'Sleep apnea & cystic fibrosis',
  ],
  Renal: [
    'Renal anatomy & physiology', 'Nephron physiology', 'Acid–base', 'Electrolytes', 'Glomerular disease',
    'AKI & CKD', 'Diuretics', 'Kidney stones', 'UTIs & cystic kidney disease', 'Renal & bladder tumors',
  ],
  GI: [
    'GI anatomy & embryology', 'GI physiology', 'Bile & bilirubin', 'Esophagus & stomach', 'Liver disease',
    'Gallbladder & biliary disease', 'Pancreatitis & pancreatic cancer', 'Malabsorption', 'Intestinal disorders', 'IBD',
    'Colorectal cancer', 'GI pharmacology',
  ],
  Endo: [
    'Thyroid', 'Adrenal', 'Diabetes', 'Reproductive hormones', 'Amenorrhea', 'Pituitary', 'Calcium & parathyroid',
    'MEN syndromes', 'Hormone signaling',
  ],
  'Heme/Onc': [
    'Coagulation', 'Bleeding & clotting disorders', 'Anticoagulants & antiplatelets', 'Hemolytic anemias',
    'Microcytic anemias', 'Other anemias & blood groups', 'Leukemias', 'Lymphomas', 'Plasma cell disorders & amyloidosis',
    'Myeloproliferative disorders', 'Cancer drugs', 'Porphyrias',
  ],
  Neuro: [
    'Neurons & neurotransmitters', 'Brain & spinal cord anatomy', 'Spinal cord syndromes', 'Brainstem & cranial nerves',
    'Deep brain structures', 'Stroke', 'Aneurysms & intracranial bleeding', 'Autonomic pharmacology',
    'Meningitis & CNS infections', 'Seizures', 'Headache', 'Dementia & delirium', 'Movement disorders',
    'Demyelinating disease', 'Neuromuscular disorders', 'Brain tumors', 'Neuroembryology', 'Eye & lens',
    'Retina & optic nerve', 'Eye movements & visual fields',
  ],
  Repro: [
    'Embryology', 'Teratogens', 'Pharyngeal arches', 'Sexual development', 'Pregnancy', 'Pregnancy complications',
    'Uterus, cervix & vagina', 'Ovarian disease', 'Breast', 'Male reproductive disease',
  ],
  MSK: [
    'Upper limb', 'Lower limb & back', 'Muscle physiology', 'Bone', 'Bone tumors', 'Arthritis & muscle disorders',
  ],
  Immuno: [
    'Innate immunity & complement', 'Adaptive immunity', 'Hypersensitivity & transplants', 'Immunodeficiencies',
    'Immunosuppressants & NSAIDs', 'Lupus & connective tissue disease', 'Rheumatoid & seronegative arthritis',
    'Vasculitis', 'Gout & CPPD',
  ],
  Micro: [
    'Bacterial basics', 'Gram-positive bacteria', 'Gram-negative bacteria', 'Spirochetes, zoonoses & mycobacteria',
    'Antibiotics', 'Fungi', 'Parasites', 'Viruses', 'Hepatitis & HIV', 'Antivirals',
  ],
  Psych: [
    'Psychology & defenses', 'Childhood disorders', 'Psychotic disorders', 'Mood & anxiety disorders',
    'Personality, somatic & dissociative disorders', 'Eating & sleep disorders', 'Substance use', 'Psychiatric drugs',
  ],
  Derm: ['Skin structure', 'Skin disorders', 'Skin infections & blistering', 'Skin cancer'],
  Pharm: ['Pharmacokinetics & dynamics', 'Anesthetics'],
  Biochem: [
    'DNA & nucleotides', 'Molecular biology', 'Lab techniques', 'Cell biology', 'Carbohydrate metabolism',
    'Energy metabolism', 'Fatty acids & ketones', 'Fed, fasting & ethanol', 'Inborn errors of metabolism',
    'Amino acids', 'Vitamins', 'Lipids', 'Lysosomal storage diseases',
  ],
  Genetics: ['Genetic principles', 'Chromosomal & genetic disorders'],
  Pathology: ['Cell injury & death', 'Inflammation & repair', 'Neoplasia'],
  Biostats: ['Biostatistics', 'Study designs & risk', 'Diagnostic tests', 'Bias & clinical trials'],
  Behavioral: ['Ethics', 'Public health & safety', 'Life cycle'],
}

export function topicId(system: string, name: string): string {
  return `${system}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export const SYSTEM_IDS = SYSTEMS.map((s) => s.id)
