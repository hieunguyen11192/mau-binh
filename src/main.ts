import { mountTable } from './ui/table'
import '../styles/main.css'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) {
  throw new Error('#app missing')
}
mountTable(app)
