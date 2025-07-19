import { sendResponse } from "./helpers/globalHelper";
import { generateCrudRoutes } from "./global/routes";
import { paginationHelper, filterHelper, pic } from "./helpers/queryHelper";
import generateCurdController from "./global/controller";

export const expressJsHelper = {
  generateCurdController,
  paginationHelper,
  filterHelper,
  pic,
  generateCrudRoutes,
  sendResponse,
};

export default expressJsHelper;
