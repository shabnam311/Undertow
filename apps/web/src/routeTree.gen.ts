import { Route as rootRoute } from '../app/routes/__root'
import { Route as indexRoute } from '../app/routes/index'

export const routeTree = rootRoute.addChildren({
  indexRoute,
})
