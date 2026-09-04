import { Route as rootRoute } from '../app/routes/__root'
import { Route as indexRoute } from '../app/routes/index'
import { Route as evaluationRoute } from '../app/routes/evaluation'

export const routeTree = rootRoute.addChildren([
  indexRoute,
  evaluationRoute,
])
