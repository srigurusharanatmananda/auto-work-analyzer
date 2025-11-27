# Free AI API Setup Guide

The manager summary feature uses AI to translate technical work into business-friendly language. The system supports **multiple free AI providers** with automatic fallback - if one provider's quota is exceeded, it automatically tries the next one!

## Quick Start

You only need **ONE** API key to get started, but adding multiple providers gives you better reliability and higher combined quotas.

---

## Option 1: Google Gemini (Recommended for Getting Started)

**Free Tier:** 60 requests/minute, generous monthly quota
**No Credit Card Required**

### Setup Steps:
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Get API Key" → "Create API Key"
4. Copy the key and add to your `.env` file:
   ```
   GOOGLE_API_KEY=AIzaSy...your_key_here
   ```

**Models Used:**
- Gemini 1.5 Flash (primary)
- Gemini 1.5 Flash-8B (fallback)

---

## Option 2: Groq (Fastest Performance)

**Free Tier:** 1,000 requests/day, 6,000 tokens/minute
**No Credit Card Required**
**Speed:** Up to 300+ tokens/second (18x faster than standard)

### Setup Steps:
1. Go to [Groq Console](https://console.groq.com/keys)
2. Sign up (free, no credit card)
3. Create an API key
4. Add to your `.env` file:
   ```
   GROQ_API_KEY=gsk_...your_key_here
   ```

**Model Used:** Llama 3.3 70B Versatile

---

## Option 3: Hugging Face (Most Models)

**Free Tier:** Community models, free inference
**No Credit Card Required**

### Setup Steps:
1. Go to [Hugging Face Settings](https://huggingface.co/settings/tokens)
2. Create a free account
3. Create a new token (Read access is sufficient)
4. Add to your `.env` file:
   ```
   HUGGINGFACE_API_KEY=hf_...your_key_here
   ```

**Model Used:** Qwen 2.5 72B Instruct

---

## Option 4: OpenRouter (Multiple Models)

**Free Tier:** 20 requests/minute, 200 requests/day on free models
**No Credit Card Required**

### Setup Steps:
1. Go to [OpenRouter Keys](https://openrouter.ai/keys)
2. Sign up (free)
3. Create an API key
4. Add to your `.env` file:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...your_key_here
   ```

**Model Used:** Llama 3.3 70B Instruct (Free)

---

## How the Fallback System Works

The system tries providers in this order:

1. **Google Gemini 1.5 Flash** (if GOOGLE_API_KEY is set)
2. **Google Gemini 1.5 Flash-8B** (if GOOGLE_API_KEY is set)
3. **Groq Llama 3.3 70B** (if GROQ_API_KEY is set)
4. **Hugging Face Qwen 2.5** (if HUGGINGFACE_API_KEY is set)
5. **OpenRouter Llama 3.3** (if OPENROUTER_API_KEY is set)

If a provider fails due to:
- Quota exceeded
- Rate limit hit
- Temporary overload

The system **automatically tries the next provider** - no manual intervention needed!

---

## Recommended Setup

For best reliability and highest combined quota:

```env
# Best: Set up multiple providers for maximum reliability
GOOGLE_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...
HUGGINGFACE_API_KEY=hf_...
OPENROUTER_API_KEY=sk-or-v1-...
```

With all four providers configured, you get:
- **Combined:** Thousands of free requests per day
- **Automatic failover** if any provider has issues
- **Zero downtime** from quota limits

---

## Testing Your Setup

After adding API keys to your `.env` file:

1. Restart the backend server:
   ```bash
   npm run webhook
   ```

2. The server will log which providers are available:
   ```
   📋 Available AI providers: Google Gemini 1.5 Flash, Google Gemini 1.5 Flash-8B, Groq Llama 3.3 70B
   ```

3. Try generating a manager summary in the UI - check the console for fallback logs:
   ```
   🤖 Attempting to generate summary with: Google Gemini 1.5 Flash
   ⏭️  Quota exceeded for Google Gemini 1.5 Flash, trying next provider...
   🤖 Attempting to generate summary with: Groq Llama 3.3 70B
   ✅ Successfully generated summary with: Groq Llama 3.3 70B
   ```

---

## Troubleshooting

### "No AI providers configured" Error
- Check that at least one API key is set in your `.env` file
- Make sure the `.env` file is in the root directory
- Restart the backend server after adding keys

### All Providers Failing
- Check that your API keys are valid (no typos)
- Verify you haven't exceeded daily limits on all providers
- Try waiting a few minutes and retry
- Check the backend console for specific error messages

### Slow Performance
- Groq is the fastest provider (300+ tokens/sec)
- Google Gemini is good balance of speed and quota
- Consider adding Groq API key for faster responses

---

## Cost Comparison

| Provider | Cost | Credit Card Required | Best For |
|----------|------|---------------------|----------|
| Google Gemini | FREE | No | Getting started, high quota |
| Groq | FREE | No | Speed, real-time apps |
| Hugging Face | FREE | No | Variety, experimentation |
| OpenRouter | FREE tier available | No | Multiple models, flexibility |

**All options are 100% free with no credit card required!**
