# Provider boundaries

Contracts are independent of React and provider SDKs. The composition root is `index.ts` (server only). All foundation providers are local or simulated. No external service is called.

Reserved adapters for later stages: GroqAIProvider, GroqTranscriptionProvider, GeminiMediaUnderstandingProvider, R2MediaStorageProvider, NotionIntelligenceProvider, XSocialPublisher, LinkedInSocialPublisher, TelegramChatChannel. Intelligence categories, platforms and source names are extensible text, not database enums.

This stage deliberately keeps AI mocked even when credentials exist, because the request prohibits external integrations. Wiring automatic Groq selection is a follow-up once external AI integration is authorized. Editorial AI analysis is not implemented.
