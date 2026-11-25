// Pathoma by chapter: which topics each chapter covers. Pathoma is a pathology book, so physiology,
// anatomy, EKG and drug topics get no Pathoma step. Chapter titles only (no numbers, nothing edition-specific).
// TODO(review): mapped from the table of contents, not from the chapter text; check borderline topics.
import { topicId } from '../topics'

export const PATHOMA_CHAPTERS: { title: string; topics: [system: string, name: string][] }[] = [
  { title: 'Growth adaptations, cellular injury and cell death', topics: [['Pathology', 'Cell injury & death']] },
  { title: 'Inflammation, inflammatory disorders and wound healing', topics: [['Pathology', 'Inflammation & repair'], ['Immuno', 'Immunodeficiencies'], ['Immuno', 'Lupus & connective tissue disease']] },
  { title: 'Principles of neoplasia', topics: [['Pathology', 'Neoplasia']] },
  { title: 'Hemostasis and related disorders', topics: [['Heme/Onc', 'Coagulation'], ['Heme/Onc', 'Bleeding & clotting disorders']] },
  { title: 'Red blood cell disorders', topics: [['Heme/Onc', 'Microcytic anemias'], ['Heme/Onc', 'Hemolytic anemias'], ['Heme/Onc', 'Other anemias & blood groups']] },
  { title: 'White blood cell disorders', topics: [['Heme/Onc', 'Leukemias'], ['Heme/Onc', 'Lymphomas'], ['Heme/Onc', 'Plasma cell disorders & amyloidosis'], ['Heme/Onc', 'Myeloproliferative disorders']] },
  { title: 'Vascular pathology', topics: [['Cardio', 'Hypertension'], ['Cardio', 'Shock & aortic disease'], ['Immuno', 'Vasculitis']] },
  { title: 'Cardiac pathology', topics: [['Cardio', 'Ischemic heart disease'], ['Cardio', 'Heart failure'], ['Cardio', 'Congenital heart disease'], ['Cardio', 'Valvular disease'], ['Cardio', 'Infective endocarditis'], ['Cardio', 'Cardiomyopathies'], ['Cardio', 'Pericardial disease']] },
  { title: 'Respiratory tract pathology', topics: [['Resp', 'Pneumonia'], ['Resp', 'Asthma & COPD'], ['Resp', 'Interstitial lung disease'], ['Resp', 'Pulmonary hypertension'], ['Resp', 'PE & DVT'], ['Resp', 'Pleural disease'], ['Resp', 'Lung cancer']] },
  { title: 'Gastrointestinal pathology', topics: [['GI', 'Esophagus & stomach'], ['GI', 'Malabsorption'], ['GI', 'Intestinal disorders'], ['GI', 'IBD'], ['GI', 'Colorectal cancer']] },
  { title: 'Exocrine pancreas, gallbladder and liver pathology', topics: [['GI', 'Pancreatitis & pancreatic cancer'], ['GI', 'Gallbladder & biliary disease'], ['GI', 'Bile & bilirubin'], ['GI', 'Liver disease']] },
  { title: 'Kidney and urinary tract pathology', topics: [['Renal', 'UTIs & cystic kidney disease'], ['Renal', 'AKI & CKD'], ['Renal', 'Glomerular disease'], ['Renal', 'Kidney stones'], ['Renal', 'Renal & bladder tumors']] },
  { title: 'Female genital system and gestational pathology', topics: [['Repro', 'Uterus, cervix & vagina'], ['Repro', 'Ovarian disease'], ['Repro', 'Pregnancy complications']] },
  { title: 'Male genital system pathology', topics: [['Repro', 'Male reproductive disease']] },
  { title: 'Endocrine pathology', topics: [['Endo', 'Pituitary'], ['Endo', 'Thyroid'], ['Endo', 'Calcium & parathyroid'], ['Endo', 'Diabetes'], ['Endo', 'Adrenal'], ['Endo', 'MEN syndromes']] },
  { title: 'Breast pathology', topics: [['Repro', 'Breast']] },
  { title: 'Central nervous system pathology', topics: [['Neuro', 'Neuroembryology'], ['Neuro', 'Spinal cord syndromes'], ['Neuro', 'Meningitis & CNS infections'], ['Neuro', 'Stroke'], ['Neuro', 'Aneurysms & intracranial bleeding'], ['Neuro', 'Demyelinating disease'], ['Neuro', 'Dementia & delirium'], ['Neuro', 'Movement disorders'], ['Neuro', 'Brain tumors']] },
  { title: 'Musculoskeletal pathology', topics: [['MSK', 'Bone'], ['MSK', 'Bone tumors'], ['MSK', 'Arthritis & muscle disorders'], ['Immuno', 'Rheumatoid & seronegative arthritis'], ['Immuno', 'Gout & CPPD'], ['Neuro', 'Neuromuscular disorders']] },
  { title: 'Skin pathology', topics: [['Derm', 'Skin disorders'], ['Derm', 'Skin infections & blistering'], ['Derm', 'Skin cancer']] },
]

/** Topic id → the Pathoma chapter that covers it. */
export const PATHOMA_BY_TOPIC: ReadonlyMap<string, string> = new Map(
  PATHOMA_CHAPTERS.flatMap((c) => c.topics.map(([sys, name]) => [topicId(sys, name), c.title] as [string, string])),
)
