'use client'

import { useState, useRef, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, CheckCircle2 } from 'lucide-react'

// Types
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface WorkflowData {
  business_problem: string
  workflow_description: string
  use_case_category: string
  channels: string[]
  complexity_tier: 'Low' | 'Medium' | 'High'
  recommended_model: string
  agents_required: number
  features: {
    rag: boolean
    memory: boolean
    db_queries: number
    tool_calls: number
    reflection: boolean
  }
  volume_estimates: {
    emails_per_month: number
    chats_per_month: number
    docs_per_month: number
    workflows_per_day: number
  }
  token_estimates: {
    input_tokens: number
    output_tokens: number
    inter_agent_tokens: number
  }
}

interface EstimatorState {
  transactions_per_month: number
  input_tokens: number
  output_tokens: number
  inter_agent_interactions: number
  rag_queries: number
  db_queries: number
  tool_calls: number
  memory_ops: number
  reflection_enabled: boolean
  model_tier: 'budget' | 'standard' | 'premium'
}

// Chat Component
function ChatTab({ onWorkflowExtracted }: { onWorkflowExtracted: (data: WorkflowData) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are an AI Solutions Architect helping users understand their AI workflow requirements.

User message: "${input}"

Previous conversation context: ${conversationHistory.length > 0 ? JSON.stringify(conversationHistory.slice(-4)) : 'First message'}

Your role:
1. Ask clarifying questions about their business workflow
2. Understand what problems they're solving
3. Extract technical requirements naturally
4. After 5-8 exchanges, provide a JSON summary of their workflow

Key things to extract:
- Business problem and workflow description
- Use case category (email automation, chat support, document processing, etc.)
- Number of agents needed
- Features required (RAG, memory, DB queries, tool calls, reflection)
- Volume estimates (emails/chats/docs per month)
- Recommended AI model tier

Be conversational, friendly, and ask follow-up questions. Don't be robotic.`,
          agent_id: 'Chat-First Discovery Interface'
        })
      })

      const data = await res.json()

      if (data.success && data.response) {
        const responseText = typeof data.response === 'string' ? data.response : JSON.stringify(data.response)

        // Check if response contains extracted JSON workflow
        const jsonMatch = responseText.match(/\{[\s\S]*"business_problem"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const extracted = JSON.parse(jsonMatch[0])
            onWorkflowExtracted(extracted)
          } catch (e) {
            // JSON parse failed, just use text response
          }
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
        }])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] gap-4">
      <ScrollArea className="flex-1 border rounded-lg p-4 bg-gray-50">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p className="font-medium mb-2">Welcome to AI Cost Discovery</p>
              <p className="text-sm">Tell me about your AI workflow and I'll help estimate your costs.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}>
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>


      <form onSubmit={sendMessage} className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe your workflow..."
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading} size="sm">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}

// Estimator Component
function EstimatorTab({ initialData, onStateChange }: { initialData: WorkflowData | null; onStateChange?: (state: EstimatorState) => void }) {
  const [state, setState] = useState<EstimatorState>({
    transactions_per_month: initialData?.volume_estimates.workflows_per_day || 100,
    input_tokens: initialData?.token_estimates.input_tokens || 500,
    output_tokens: initialData?.token_estimates.output_tokens || 800,
    inter_agent_interactions: initialData?.agents_required || 1,
    rag_queries: initialData?.features.rag ? 5 : 0,
    db_queries: initialData?.features.db_queries || 0,
    tool_calls: initialData?.features.tool_calls || 0,
    memory_ops: initialData?.features.memory ? 2 : 0,
    reflection_enabled: initialData?.features.reflection || false,
    model_tier: initialData?.recommended_model?.includes('GPT-4') ? 'premium' : 'standard',
  })

  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  const handleSliderChange = (key: keyof EstimatorState, value: number[]) => {
    setState(prev => ({ ...prev, [key]: value[0] }))
  }

  const toggleFeature = (key: string) => {
    setState(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Model Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Recommended Model Tier</label>
            <Select value={state.model_tier} onValueChange={(val: any) => setState(prev => ({ ...prev, model_tier: val }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="budget">Budget (DeepSeek R1) - $0.50/M input</SelectItem>
                <SelectItem value="standard">Standard (Claude Sonnet) - $3/M input</SelectItem>
                <SelectItem value="premium">Premium (GPT-4o) - $5/M input</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Volume Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Volume Estimates</CardTitle>
          <CardDescription>Adjust based on your actual usage patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SliderInput
            label="Transactions Per Month"
            value={state.transactions_per_month}
            min={10}
            max={100000}
            step={100}
            onChange={(val) => handleSliderChange('transactions_per_month', [val])}
          />
          <SliderInput
            label="Avg Input Tokens Per Request"
            value={state.input_tokens}
            min={100}
            max={5000}
            step={100}
            onChange={(val) => handleSliderChange('input_tokens', [val])}
          />
          <SliderInput
            label="Avg Output Tokens Per Request"
            value={state.output_tokens}
            min={100}
            max={5000}
            step={100}
            onChange={(val) => handleSliderChange('output_tokens', [val])}
          />
        </CardContent>
      </Card>

      {/* Agent Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agent Interactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <SliderInput
            label="Multi-Agent Interactions Per Request"
            value={state.inter_agent_interactions}
            min={1}
            max={5}
            step={1}
            onChange={(val) => handleSliderChange('inter_agent_interactions', [val])}
          />
        </CardContent>
      </Card>

      {/* Features Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feature Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeatureToggle
            label="Retrieval-Augmented Generation (RAG)"
            enabled={state.rag_queries > 0}
            onToggle={() => setState(prev => ({
              ...prev,
              rag_queries: prev.rag_queries > 0 ? 0 : 5
            }))}
          />
          {state.rag_queries > 0 && (
            <SliderInput
              label="RAG Queries Per Request"
              value={state.rag_queries}
              min={1}
              max={20}
              step={1}
              onChange={(val) => handleSliderChange('rag_queries', [val])}
            />
          )}

          <Separator />

          <FeatureToggle
            label="Long-Term Memory"
            enabled={state.memory_ops > 0}
            onToggle={() => setState(prev => ({
              ...prev,
              memory_ops: prev.memory_ops > 0 ? 0 : 2
            }))}
          />
          {state.memory_ops > 0 && (
            <SliderInput
              label="Memory Operations Per Request"
              value={state.memory_ops}
              min={1}
              max={10}
              step={1}
              onChange={(val) => handleSliderChange('memory_ops', [val])}
            />
          )}

          <Separator />

          <FeatureToggle
            label="Database Queries"
            enabled={state.db_queries > 0}
            onToggle={() => setState(prev => ({
              ...prev,
              db_queries: prev.db_queries > 0 ? 0 : 2
            }))}
          />
          {state.db_queries > 0 && (
            <SliderInput
              label="DB Queries Per Request"
              value={state.db_queries}
              min={1}
              max={10}
              step={1}
              onChange={(val) => handleSliderChange('db_queries', [val])}
            />
          )}

          <Separator />

          <FeatureToggle
            label="Tool/API Calls"
            enabled={state.tool_calls > 0}
            onToggle={() => setState(prev => ({
              ...prev,
              tool_calls: prev.tool_calls > 0 ? 0 : 2
            }))}
          />
          {state.tool_calls > 0 && (
            <SliderInput
              label="Tool Calls Per Request"
              value={state.tool_calls}
              min={1}
              max={10}
              step={1}
              onChange={(val) => handleSliderChange('tool_calls', [val])}
            />
          )}

          <Separator />

          <FeatureToggle
            label="Reflection & Safety Checks"
            enabled={state.reflection_enabled}
            onToggle={() => setState(prev => ({
              ...prev,
              reflection_enabled: !prev.reflection_enabled
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// Slider Input Component
function SliderInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number[]) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-lg font-semibold text-blue-600">{value.toLocaleString()}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={onChange}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  )
}

// Feature Toggle Component
function FeatureToggle({
  label,
  enabled,
  onToggle,
}: {
  label: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
        enabled
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
          enabled ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
        }`}>
          {enabled && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>
        <span className="font-medium text-sm">{label}</span>
      </div>
    </button>
  )
}

// Cost Calculator
function CostCalculator(state: EstimatorState) {
  const pricingTiers = {
    budget: { input: 0.50, output: 1.50 },
    standard: { input: 3, output: 9 },
    premium: { input: 5, output: 15 },
  }

  const pricing = pricingTiers[state.model_tier]

  // Calculate tokens per month
  const totalInputTokens = state.transactions_per_month * state.input_tokens
  const totalOutputTokens = state.transactions_per_month * state.output_tokens
  const interAgentTokens = state.transactions_per_month * state.inter_agent_interactions * (state.input_tokens + state.output_tokens) * 0.3

  // Feature overhead
  const ragTokens = state.rag_queries * state.transactions_per_month * 200
  const dbQueryTokens = state.db_queries * state.transactions_per_month * 150
  const toolCallTokens = state.tool_calls * state.transactions_per_month * 100
  const memoryTokens = state.memory_ops * state.transactions_per_month * 100
  const reflectionTokens = state.reflection_enabled ? state.transactions_per_month * 300 : 0

  const totalInputCost = (totalInputTokens + interAgentTokens + ragTokens + dbQueryTokens + toolCallTokens + memoryTokens + reflectionTokens) / 1_000_000 * pricing.input
  const totalOutputCost = totalOutputTokens / 1_000_000 * pricing.output
  const totalMonthly = totalInputCost + totalOutputCost

  return {
    inputTokens: totalInputTokens + interAgentTokens + ragTokens + dbQueryTokens + toolCallTokens + memoryTokens + reflectionTokens,
    outputTokens: totalOutputTokens,
    inputCost: totalInputCost,
    outputCost: totalOutputCost,
    totalMonthly,
    totalAnnual: totalMonthly * 12,
  }
}

// Results Component
function ResultsTab({ state }: { state: EstimatorState }) {
  const costs = CostCalculator(state)

  return (
    <div className="space-y-6">
      {/* Monthly Cost Summary */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-2xl">Monthly Estimate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-4xl font-bold text-blue-600 mb-2">
              ${costs.totalMonthly.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">
              Annual: ${costs.totalAnnual.toFixed(2)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CostRow
            label="Input Tokens"
            value={costs.inputTokens}
            cost={costs.inputCost}
          />
          <CostRow
            label="Output Tokens"
            value={costs.outputTokens}
            cost={costs.outputCost}
          />
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">Total Monthly Cost</span>
            <span className="text-xl font-bold text-blue-600">${costs.totalMonthly.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Volume Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Transactions/Month:</span>
            <span className="font-medium">{state.transactions_per_month.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Model Tier:</span>
            <Badge variant="outline" className="capitalize">{state.model_tier}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Active Features:</span>
            <span className="font-medium">
              {[
                state.rag_queries > 0 && 'RAG',
                state.memory_ops > 0 && 'Memory',
                state.db_queries > 0 && 'DB',
                state.tool_calls > 0 && 'Tools',
                state.reflection_enabled && 'Reflection'
              ].filter(Boolean).join(', ') || 'None'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage Scenarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScenarioRow
            name="10x Growth"
            multiplier={10}
            currentCost={costs.totalMonthly}
          />
          <ScenarioRow
            name="5x Growth"
            multiplier={5}
            currentCost={costs.totalMonthly}
          />
          <ScenarioRow
            name="2x Growth"
            multiplier={2}
            currentCost={costs.totalMonthly}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// Cost Row Component
function CostRow({
  label,
  value,
  cost,
}: {
  label: string
  value: number
  cost: number
}) {
  return (
    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
      <div>
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-sm text-gray-600">{(value / 1_000_000).toFixed(2)}M tokens</div>
      </div>
      <div className="text-lg font-semibold text-gray-900">${cost.toFixed(2)}</div>
    </div>
  )
}

// Scenario Row Component
function ScenarioRow({
  name,
  multiplier,
  currentCost,
}: {
  name: string
  multiplier: number
  currentCost: number
}) {
  return (
    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
      <span className="font-medium text-gray-900">{name}</span>
      <span className="text-lg font-semibold text-gray-900">
        ${(currentCost * multiplier).toFixed(2)}
      </span>
    </div>
  )
}

// Main App
export default function HomePage() {
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null)
  const [estimatorState, setEstimatorState] = useState<EstimatorState>({
    transactions_per_month: 100,
    input_tokens: 500,
    output_tokens: 800,
    inter_agent_interactions: 1,
    rag_queries: 0,
    db_queries: 0,
    tool_calls: 0,
    memory_ops: 0,
    reflection_enabled: false,
    model_tier: 'standard',
  })

  const handleWorkflowExtracted = (data: WorkflowData) => {
    setWorkflowData(data)
    // Auto-populate estimator state from workflow
    setEstimatorState({
      transactions_per_month: data.volume_estimates.workflows_per_day * 22 || 100,
      input_tokens: data.token_estimates.input_tokens || 500,
      output_tokens: data.token_estimates.output_tokens || 800,
      inter_agent_interactions: data.agents_required || 1,
      rag_queries: data.features.rag ? 5 : 0,
      db_queries: data.features.db_queries || 0,
      tool_calls: data.features.tool_calls || 0,
      memory_ops: data.features.memory ? 2 : 0,
      reflection_enabled: data.features.reflection || false,
      model_tier: data.recommended_model?.includes('Budget') ? 'budget' :
                  data.recommended_model?.includes('Premium') ? 'premium' : 'standard',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Cost Estimator</h1>
          <p className="text-gray-600">Discover your workflow, estimate your costs</p>
        </div>

        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat">Discovery Chat</TabsTrigger>
            <TabsTrigger value="estimator">Cost Estimator</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Describe Your Workflow</CardTitle>
                <CardDescription>
                  Tell me about your AI use case and I'll extract the details needed for cost estimation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChatTab onWorkflowExtracted={handleWorkflowExtracted} />
              </CardContent>
            </Card>
            {workflowData && (
              <Card className="mt-4 border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Workflow extracted! Check the Cost Estimator tab to adjust parameters.</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="estimator" className="mt-6">
            <EstimatorTab initialData={workflowData} onStateChange={setEstimatorState} />
          </TabsContent>

          <TabsContent value="results" className="mt-6">
            <ResultsTab state={estimatorState} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
