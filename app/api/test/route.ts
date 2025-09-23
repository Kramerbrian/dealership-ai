import { NextRequest, NextResponse } from 'next/server'
import { globalPromptPack } from '@/lib/promptPack'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    // Load prompt pack if not already loaded
    if (!globalPromptPack['promptPack']) {
      const promptPackPath = join(process.cwd(), 'data/prompt-packs/dealershipai_prompt_pack_v1.json')
      try {
        const data = readFileSync(promptPackPath, 'utf-8')
        globalPromptPack.loadFromString(data)
        console.log('Prompt pack loaded successfully')
      } catch (error) {
        console.error('Failed to load prompt pack:', error)
        return NextResponse.json(
          { error: 'Failed to load prompt pack', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    }

    // Get prompts
    const prompts = globalPromptPack.getPrompts()
    const stats = globalPromptPack.getStats()
    const validationErrors = globalPromptPack.getValidationErrors()

    return NextResponse.json({
      success: true,
      prompt_count: prompts.length,
      stats,
      validation_errors: validationErrors,
      sample_prompt: prompts[0] ? {
        id: prompts[0].id,
        title: prompts[0].title,
        category: prompts[0].category,
      } : null,
    })

  } catch (error) {
    console.error('Error in /api/test GET:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}