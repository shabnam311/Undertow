import { Route as rootRoute } from '../app/routes/__root'
import { Route as indexRoute } from '../app/routes/index'
import { Route as evaluationRoute } from '../app/routes/evaluation'
import { Route as loginRoute } from '../app/routes/login'
import { Route as settingsRoute } from '../app/routes/settings'

export const routeTree = rootRoute.addChildren([
  indexRoute,
  evaluationRoute,
  loginRoute,
  settingsRoute,
])
