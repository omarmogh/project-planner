// First Aid sections, one per topic.
//
// NOT EXTRACTED YET: the First Aid book wasn't in /resources-src when this was
// built, so each "section" is named after its topic ("First Aid: Heart failure"),
// which is what a student looks up anyway. Once the book is there, generate the
// real section headings the same way as scripts/gen-bnb.mjs (titles only, no
// page numbers, nothing edition-specific) and replace this file.
// TODO(placeholder): real First Aid section headings.
import { TOPICS, topicId } from '../topics'
import type { ResourceItem } from './types'

export const FIRST_AID_EXTRACTED = false

export const FIRST_AID: ResourceItem[] = Object.entries(TOPICS).flatMap(([system, names]) =>
  names.map((name) => ({ id: `fa-${topicId(system, name)}`, title: name, system, topicIds: [topicId(system, name)] })),
)
