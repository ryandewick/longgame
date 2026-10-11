import { buildMethodsExport } from '#shared/domain/site'

/** GET /data/methods.json: the method data, published under the wiki's licence with its source named. */
export default defineEventHandler(() => buildMethodsExport())
