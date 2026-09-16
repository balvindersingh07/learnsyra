import { isAdminApp } from './lib/appMode'
import AppAdmin from './AppAdmin'
import AppPublic from './AppPublic'

export type { Page } from './lib/paths'

export default function App() {
  return isAdminApp() ? <AppAdmin /> : <AppPublic />
}
