# Learning module: teaching Sanskrit and Tamil to one absolute beginner

**Status: spec, not yet planned into phases of work.** Supersedes the "Not
planned here: the learning module" section of
[`../plans/2026-08-05-platform-consolidation.md`](../plans/2026-08-05-platform-consolidation.md),
which recorded this as blocked on a human decision. It is not blocked. This
document says why.

## Who this is for

**One user: the operator, who does not speak either language.** Not a product,
not a cohort, not a marketplace. That single fact settles most of what the
earlier plan treated as open:

- **Cost is negligible.** Per-character TTS pricing, seat licensing and rate
  limits are irrelevant at one user. Options that would be unaffordable for a
  product are free here.
- **There is no reciter and there will not be one.** So any design that requires
  recorded human audio as a *precondition* is not a design, it is a wish.
- **Correct Vedic pitch accent is a stage-four problem.** A learner starting from
  zero needs letters, then words, then sentences. Chanting with correct *svara*
  matters eventually and does not gate anything now.

The earlier plan blocked the whole phase on the hardest requirement of the last
stage. That was the mistake.

## What changed since the plan

The plan said Sanskrit TTS is "scarce" and the realistic options are a recorded
reciter or "a Hindi voice approximating Devanagari, which mispronounces Vedic
length and pitch."

That conflated two different failures, and only one of them is still real.

### The mispronunciation has a known fix

Feeding Sanskrit in **Devanagari** to a Hindi-trained model triggers **schwa
deletion** — Hindi drops inherent vowels that Sanskrit keeps, so `rāma` comes out
as `rām`. This is the mispronunciation the plan described, and it is not a
property of Sanskrit being hard. It is an artefact of the input script selecting
Hindi phonology.

The fix, used independently by both [`sanskrit_tts`](https://github.com/avinashvarna/sanskrit_tts)
and the [Vāgdhenu](https://huggingface.co/prathoshap/vagdhenu) chant system, is
to **synthesise from Kannada transliteration**. Kannada script does not carry the
schwa-deletion convention, so the phonology comes out closer to Sanskrit.

**Consequence for this design: the learner is shown Devanagari; the synthesiser
is fed Kannada.** Transliteration is an internal step, invisible in the UI.

### Sanskrit TTS now exists properly

[AI4Bharat Indic-Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts)
supports Sanskrit officially — reported 99.79 native-speaker score, described as
near-perfect for classical use. Apache-2.0, 0.9B parameters, CPU-capable,
69 voices.

Two properties make it the right choice here rather than merely an available one:

1. **It covers Tamil too.** One model, one integration, both languages. Every
   alternative means two pipelines.
2. **Prosody is controlled by a plain-text description** — "slow, clear,
   measured, no background noise". For teaching, "say this slowly and clearly"
   is exactly the control needed, and it is a string rather than a parameter
   sweep.

### What still has no answer

**Vedic pitch accent.** Vāgdhenu is the best Sanskrit *chant* system found —
meter-aware, MOS ~4.6 from expert listeners, conjuncts and retroflex aspirates
rendering correctly — and its documentation states plainly: **"No Vedic svaras."**
Nothing synthesises them.

So the reciter is not ruled out forever; it is **scoped down to one slice**:
Vedic chant where pitch accent is the substance. That slice is deferred, and
the door stays open. Nothing else waits on it.

**Bhashini is a red herring here**, worth naming because the sister repo already
integrates it: it does **not** support Sanskrit natively. `sanskrit_tts` reaches
it only through the same Kannada workaround. The existing integration buys less
than it appears to.

## The probe: can Whisper hear vowel length?

Pronunciation feedback is the one thing an app does that a book cannot — record
the learner, transcribe, diff against the intended text. In Sanskrit the
commonest beginner error is vowel length, and it is meaning-bearing: `dina`
(day) and `dīna` (wretched) are different words. If the ASR cannot hear that
contrast it cannot give the feedback, whatever its headline accuracy.

Run 2026-08-08 against the deployed Whisper service (`base`, int8, CPU). Ten
minimal pairs differing only in one vowel's length, synthesised with a Hindi
voice (Hindi contrasts /a/ and /aː/ natively, so the source audio carries a real
distinction), plus two short phrases. Script:
[`../probes/2026-08-08-whisper-sanskrit-vowel-length.sh`](../probes/2026-08-08-whisper-sanskrit-vowel-length.sh).

### Result: unusable at `base`, but the failure is not where expected

| input | gloss | `language=sa` output |
|---|---|---|
| दिन `dina` | day | `Then` |
| दीन `dīna` | wretched | `Dean` |
| कर `kara` | hand | `Kutt` |
| कार `kāra` | maker | `Kaad` |
| सुत `suta` | son | `Sub` |
| सूत `sūta` | charioteer | `Soot` |
| पुर `pura` | city | `por` |
| पूर `pūra` | flood | `4.` |
| ॐ नमः शिवाय | | `ھن نمیں شوائی` |
| सत्यमेव जयते | | `ستیمیف جایتے` |

**It never once produced Devanagari.** Forcing `language=sa` did not help;
auto-detection returned `en`, `hi` and even `ru`. Phrases came back in
Arabic/Urdu script.

But look at the pairs. `dina`→"Then" versus `dīna`→"Dean". `kara`→"Cut" versus
`kāra`→"Kaad". **The length contrast survives into the output** — the encoder is
hearing the difference; the decoder is mapping it onto whatever language it
believes it heard, and never onto Sanskrit.

### What that licenses, and what it does not

- **Do not build pronunciation feedback on the current deployment.** It cannot
  emit Sanskrit at all, so there is nothing to diff against.
- **Do not conclude Whisper cannot do this.** `base` is the smallest useful size,
  the audio was synthetic and single-word (no language-model context — the
  hardest case), and the published Sanskrit ASR result of **15.42% WER** uses a
  *fine-tuned* model, which this is not.
- **The acoustic signal is there.** That the contrast reaches the output through
  a wrong-language decoder is mildly encouraging for a fine-tuned model later.
- **Even so, 15.42% WER on read speech by competent speakers is a weak
  foundation** for scoring a beginner's deliberate mispronunciation. This should
  be treated as a research experiment, not a feature.

**Design consequence: stages 1–3 assume no ASR. Feedback is a separate
experiment, gated on its own probe.**

### Incidental finding

The Whisper service accepts `call_id` as a **string** on the request but its
response model declares `callId: int`, so any non-numeric id fails with a
Pydantic validation error surfaced as `Transcription failed:`. The app always
passes numeric ids, so it does not bite in production. Worth fixing when that
file is next touched — the request-side comment explicitly claims a wider type
"costs nothing", and this is what it costs.

## Design

### Curriculum, four stages

Stage 1–3 are the deliverable. Stage 4 is where the deferred problems live.

1. **Letters.** Devanagari and Tamil script, one grapheme at a time, with its
   sound. Recognition before production.
2. **Words.** Vocabulary with audio, built only from letters already taught.
3. **Sentences.** Short, grammatically simple, using known words.
4. **Chanting.** Deferred. Needs Vāgdhenu, and accepts no *svaras* until a
   reciter exists.

**The learner must be told where to start.** A single "continue" affordance, not
a menu — the plan's "needs to be *told* where to start" is the requirement that
kills a browse-everything design.

### Where this sits in the codebase

Follows the existing module shape (`src/calls/`, `src/scanning/`):

```
src/learn/
  Curriculum.ts        the stage/lesson graph; what is unlocked and what is next
  Transliterator.ts    Devanagari|Tamil → Kannada for synthesis. THE seam.
  SpeechClient.ts      Indic-Parler-TTS; mirrors WhisperClient's shape
  AudioCache.ts        synthesised audio keyed by (text, voice, prosody)
  Progress.ts          what has been seen, what is due
```

Two notes on the seams:

- **`Transliterator` is the piece to get right.** The Kannada-routing trick lives
  here and nowhere else. If a better Sanskrit voice appears that takes Devanagari
  directly, this becomes a no-op and nothing else changes.
- **`AudioCache` is not an optimisation, it is the architecture.** At one user the
  same hundred lessons are replayed constantly; synthesising each time wastes
  compute and makes the app feel slow for no reason. Cache keyed on the text and
  the prosody description, so changing the description invalidates correctly.

`SpeechClient` should mirror `WhisperClient` deliberately — same
health-check-then-call shape, same container-path rewriting if it runs in Docker.
That is an existing, working pattern for "a Python model service beside the Node
app", and there is no reason to invent a second one.

### Storage

Reuse the existing Postgres and Drizzle setup. Two tables, both per-user even
though there is one user, because every other table in this schema is and being
the exception costs more than the column:

- `learn_progress` — lesson id, first seen, last seen, times correct
- `learn_audio` — cache metadata; the audio itself on disk under `storage/`

### Prosody

One description string, tuned once, held constant: slow, clear, measured, no
background noise. Speed is the variable worth exposing to the learner. Nothing
else about the voice should be adjustable — it is a teaching voice, not a toy.

## Risks

- **The 99.79 Sanskrit score is a reported metric, not something verified here.**
  Verify by ear on the first ten words before building a curriculum on top. A
  beginner cannot detect a bad teacher, which makes this the one quality gate
  that has to be human.
- **Indic-Parler-TTS is 0.9B and CPU inference will be slow.** The cache hides
  this for repeat plays but not for first plays. Measure before designing the
  lesson flow around instant audio.
- **Transliteration correctness is silent when wrong.** A bad Devanagari→Kannada
  mapping produces confident, wrong pronunciation that the learner will faithfully
  copy. Needs a test with known pairs, not a spot check.
- **No pronunciation feedback means no error detection at all** in stages 1–3.
  The learner can practise a mistake indefinitely. Worth stating as an accepted
  limitation rather than pretending recognition covers it.

## Verification

- Transliterator: a table of known Devanagari→Kannada pairs, including
  conjuncts and both vowel lengths. Mechanical, and the one place a silent
  error is unrecoverable.
- Curriculum: stage N+1 never introduces a grapheme stage N did not teach.
  Assertable over the whole graph, and the property that makes it a curriculum
  rather than a list.
- Audio cache: same text and prosody hits; changed prosody misses.
- **No test may call a live TTS or AI provider**, per the standing rule. The
  speech client is stubbed; the real model is exercised by hand.
- First ten synthesised words reviewed by a human ear before stage 2 is built.

## Open, and genuinely for a human

1. **Which language first, or both at once?** Tamil is a living language with
   better tooling and immediate practical use; Sanskrit is the harder problem and
   presumably the actual motivation. Doing both at once doubles the curriculum
   work for one learner.
2. **Whether a fine-tuned Sanskrit Whisper is worth the effort later**, purely
   for pronunciation feedback, given that even the published result is marginal.
