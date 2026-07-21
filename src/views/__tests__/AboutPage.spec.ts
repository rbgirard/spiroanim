import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import AboutPage from '@/views/AboutPage.vue'

describe('About view', () => {
  it('describes the project and links to its source repository', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/about', component: AboutPage },
      ],
    })
    await router.push('/about')
    await router.isReady()

    const wrapper = mount(AboutPage, { global: { plugins: [router] } })
    const repositoryLink = wrapper.get('a.repository-link')

    expect(wrapper.get('h1').text()).toContain('Years')
    expect(wrapper.text()).toContain('many iterations over several years')
    expect(wrapper.text()).toContain('remains, open source')
    expect(wrapper.text()).toContain('Many upgrades are in the works and coming soon')
    expect(wrapper.text()).toContain('Offline-capable')
    expect(wrapper.text()).toContain('can reopen without a network connection')
    expect(wrapper.text()).toContain('check for newer versions')
    expect(wrapper.text()).toContain('A progressive web app')
    expect(wrapper.text()).toContain('launched from your desktop or home screen')
    expect(wrapper.text()).toContain('normal update prompt')
    expect(wrapper.findAll('.detail-marker')).toHaveLength(4)
    expect(wrapper.get('a.back-link').attributes('href')).toBe('/')
    expect(repositoryLink.attributes('href')).toBe('https://github.com/rbgirard/spiroanim/')
    expect(repositoryLink.attributes('target')).toBe('_blank')
    expect(repositoryLink.attributes('rel')).toContain('noopener')
  })
})
