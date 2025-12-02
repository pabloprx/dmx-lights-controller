import { getLinkState } from "../../utils/linkState";

export default defineEventHandler(() => {
  return getLinkState();
});
