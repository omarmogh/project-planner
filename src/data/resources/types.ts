/** One piece of a resource (a B&B video, a First Aid section), mapped to topics. Titles only. */
export interface ResourceItem {
  id: string
  title: string
  system: string
  topicIds: string[]
}
