import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { TableAggregate } from "@convex-dev/aggregate";

export const usageAggregate = new TableAggregate<{
  Namespace: string; // projectId
  Key: null; // we don’t need sorting
  DataModel: DataModel;
  TableName: "usage";
}>(components.usageAggregate, {
  namespace: (doc) => doc.projectId,
  sortKey: () => null,
});
