---
title: "miniti – privacy & terms"
url: "/miniti/privacy"
---

# privacy & terms

*last updated: february 2026*

## what miniti does

miniti records meetings on your device, transcribes them using [deepgram](https://deepgram.com), and generates summaries and insights using [openai](https://openai.com).

## where your data lives

all meeting content — transcripts, notes, summaries, action items, MEDDPICC analysis — is stored **locally on your device only**. miniti does not upload, copy, or back up your meeting content to any server.

## what is sent to third parties

- **audio** is streamed to [deepgram](https://deepgram.com) during recording for real-time transcription. it is not stored by miniti.
- **transcript text** is sent to [openai](https://openai.com) when generating summaries and insights.

both services process data under their own privacy policies ([deepgram](https://deepgram.com/privacy), [openai](https://openai.com/policies/privacy-policy)).

## managed mode (early adopter)

if you use miniti in managed mode (500 free mins/month), an anonymous device identifier is sent to our backend to track usage. this identifier is a random UUID — it is not tied to your name, email, or apple ID. no meeting content is sent to or stored on our backend.

## bring your own keys mode

if you provide your own deepgram and openai API keys, **nothing leaves your device** except direct API calls to those services. miniti has no backend involvement.

## api keys

api keys you enter are stored locally on your device. they are never sent to miniti's servers.

## analytics

the miniti app does not include any analytics or telemetry. the [miniti website](https://ianahuja.com/miniti) uses posthog for anonymous page analytics.

## no account required

miniti does not require you to create an account, sign in, or provide personal information to use the app.

## gdpr

miniti processes minimal personal data. the legal basis for processing is **contract performance** (providing the service you use) and **legitimate interest** (anonymous usage tracking in managed mode).

since meeting content is stored locally on your device, you already have full control over your data. you can view, export, or delete your meetings at any time from within the app.

audio and transcript data sent to deepgram and openai may be transferred to servers in the united states. both providers maintain appropriate safeguards for international data transfers under their respective data processing agreements.

if you use managed mode, you can request deletion of your anonymous usage data by contacting us. since the device identifier is a random UUID not linked to your identity, we cannot associate it with you unless you tell us your device ID.

## contact

questions or data requests? email miniti [at] ianahuja [dot] com.
