/** A sample item as the UI shows it (mapped from the API's SampleItem by data/). */
export interface SampleItem {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: string;
}
