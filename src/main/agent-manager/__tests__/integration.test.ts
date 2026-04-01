/**
 * Integration tests for BDE native agent system
 */
import { describe, it, expect } from 'vitest'
import { pipelinePersonality } from '../../agent-system/personality/pipeline-personality'
import { assistantPersonality } from '../../agent-system/personality/assistant-personality'
import { getAllMemory } from '../../agent-system/memory'
import { getAllSkills, getSkillList } from '../../agent-system/skills'
import { buildAgentPrompt } from '../prompt-composer'

describe('Agent System Integration', () => {
  describe('Personality Module', () => {
    it('exports pipeline personality with all required fields', () => {
      expect(pipelinePersonality).toBeDefined()
      expect(pipelinePersonality.voice).toContain('concise')
      expect(pipelinePersonality.roleFrame).toContain('pipeline agent')
      expect(pipelinePersonality.constraints[0]).toContain('NEVER push to main')
      expect(pipelinePersonality.patterns.length).toBeGreaterThan(0)
    })

    it('exports assistant personality with all required fields', () => {
      expect(assistantPersonality).toBeDefined()
      expect(assistantPersonality.voice).toContain('conversational')
      expect(assistantPersonality.roleFrame).toContain('BDE assistant')
      expect(assistantPersonality.constraints.length).toBeGreaterThan(0)
      expect(assistantPersonality.patterns[0]).toContain('Suggest creating sprint tasks')
    })
  })

  describe('Memory Module', () => {
    it('exports getAllMemory function that returns conventions', () => {
      const memory = getAllMemory()
      expect(memory).toContain('IPC Conventions')
      expect(memory).toContain('Testing Patterns')
      expect(memory).toContain('Architecture Rules')
      expect(memory).toContain('safeHandle')
      expect(memory.length).toBeGreaterThan(500)
    })
  })

  describe('Skills Module', () => {
    it('exports getAllSkills function that returns formatted guidance', () => {
      const skills = getAllSkills()
      expect(skills).toContain('System Introspection')
      expect(skills).toContain('Task Orchestration')
      expect(skills).toContain('Code Patterns')
      expect(skills.length).toBeGreaterThan(300)
    })

    it('exports getSkillList function that returns skill objects', () => {
      const skillList = getSkillList()
      expect(skillList.length).toBe(3)
      expect(skillList[0]).toHaveProperty('id')
      expect(skillList[0]).toHaveProperty('trigger')
      expect(skillList[0]).toHaveProperty('description')
      expect(skillList[0]).toHaveProperty('guidance')
    })
  })

  describe('Prompt Composer Integration', () => {
    it('includes native system when useNativeSystem is true for pipeline agent', () => {
      const prompt = buildAgentPrompt({
        agentType: 'pipeline',
        taskContent: 'Build feature X',
        branch: 'feat/test',
        useNativeSystem: true
      })

      expect(prompt).toContain('## Voice')
      expect(prompt).toContain('concise')
      expect(prompt).toContain('## Your Role')
      expect(prompt).toContain('## Constraints')
      expect(prompt).toContain('NEVER push to main')
      expect(prompt).toContain('## BDE Conventions')
      expect(prompt).toContain('IPC Conventions')
      expect(prompt).toContain('Build feature X')
    })

    it('includes native system when useNativeSystem is true for assistant agent', () => {
      const prompt = buildAgentPrompt({
        agentType: 'assistant',
        taskContent: 'Help me understand X',
        useNativeSystem: true
      })

      expect(prompt).toContain('## Voice')
      expect(prompt).toContain('conversational')
      expect(prompt).toContain('## Your Role')
      expect(prompt).toContain('BDE assistant')
      expect(prompt).toContain('## BDE Conventions')
      expect(prompt).toContain('## Available Skills')
      expect(prompt).toContain('System Introspection')
    })

    it('excludes skills for pipeline agents even when useNativeSystem is true', () => {
      const prompt = buildAgentPrompt({
        agentType: 'pipeline',
        taskContent: 'Build feature X',
        branch: 'feat/test',
        useNativeSystem: true
      })

      expect(prompt).not.toContain('## Available Skills')
    })

    it('uses legacy role instructions when useNativeSystem is false', () => {
      const prompt = buildAgentPrompt({
        agentType: 'pipeline',
        taskContent: 'Build feature X',
        branch: 'feat/test',
        useNativeSystem: false
      })

      expect(prompt).not.toContain('## Voice')
      expect(prompt).not.toContain('## BDE Conventions')
      expect(prompt).toContain('## Your Mission')
      expect(prompt).toContain('Build feature X')
    })

    it('defaults to legacy behavior when useNativeSystem is undefined', () => {
      const prompt = buildAgentPrompt({
        agentType: 'pipeline',
        taskContent: 'Build feature X',
        branch: 'feat/test'
      })

      expect(prompt).not.toContain('## Voice')
      expect(prompt).not.toContain('## BDE Conventions')
      expect(prompt).toContain('## Your Mission')
    })
  })
})
