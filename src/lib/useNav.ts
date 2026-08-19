import { useNavigate } from 'react-router-dom'
import { coursePath, pagePath, type Page } from './paths'

/**
 * Bridges the existing `onNav(page)` API used across the pages to real
 * URL navigation. Pass a course id as the second argument for course detail.
 */
export function useNav() {
  const navigate = useNavigate()
  return (page: Page, extra?: string) => {
    const path =
      page === 'course-detail' && extra ? coursePath(extra) : pagePath[page]
    navigate(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
