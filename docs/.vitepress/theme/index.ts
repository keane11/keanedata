import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import ThemePicker from './ThemePicker.vue'
import ReadingTime from './ReadingTime.vue'
import RecentPosts from './RecentPosts.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(ThemePicker),
      'doc-before': () => h(ReadingTime),
      'home-features-after': () => h(RecentPosts),
    })
  },
}
