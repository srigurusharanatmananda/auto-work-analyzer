#!/usr/bin/env bash
# Throwaway probe: can Whisper hear Sanskrit vowel length?
#
# The question that matters for a learning app is narrow. Pronunciation feedback
# means recording a learner and diffing what they said against what was
# intended. In Sanskrit the single most common beginner error is vowel length —
# `dina` (day) vs `dīna` (wretched) are different words — so if the ASR cannot
# hear that contrast, it cannot give the feedback, however good its word-level
# accuracy looks.
#
# Method: synthesise minimal pairs that differ ONLY in vowel length using a
# Hindi voice (Hindi contrasts /a/ and /aː/ natively, so the source audio has a
# real distinction), then transcribe each and see whether the transcript
# preserves it.
#
# Known limits, stated so nobody over-reads the result:
#  - The model is `base`, the smallest useful size. A negative result here is a
#    FLOOR, not a verdict: the published Sanskrit ASR result (15.42% WER) uses a
#    fine-tuned model, which this is not.
#  - Source audio is synthetic. A real learner's mispronunciation is a different
#    signal from a TTS voice reading correctly.
#  - Single-word audio gives Whisper no language-model context, which is the
#    hardest case for it. That is deliberate — it is also the case a drilling
#    app would present.

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/audio"
mkdir -p "$OUT"

# Devanagari, romanisation, gloss. Every pair differs only in one vowel's length.
PAIRS=(
  "दिन|dina|day"
  "दीन|dīna|wretched"
  "कर|kara|hand"
  "कार|kāra|maker"
  "सुत|suta|son"
  "सूत|sūta|charioteer"
  "वर|vara|boon"
  "वार|vāra|occasion"
  "पुर|pura|city"
  "पूर|pūra|flood"
)

# A short phrase too: single words are the hardest case, so this checks whether
# context rescues it.
PHRASES=(
  "ॐ नमः शिवाय|om namaḥ śivāya"
  "सत्यमेव जयते|satyameva jayate"
)

say_to_wav() {
  local text="$1" path="$2"
  # `-r 130` slows delivery: a single Sanskrit word at default rate is ~0.3s,
  # and Whisper returns nothing at all below about a second. Half a second of
  # silence is padded on each end for the same reason — the model needs room
  # either side of the speech, and without it short clips come back empty.
  say -v Lekha -r 130 -o "${path%.wav}.aiff" "$text" 2>/dev/null || return 1
  ffmpeg -y -loglevel error \
    -f lavfi -t 0.5 -i anullsrc=r=16000:cl=mono \
    -i "${path%.wav}.aiff" \
    -f lavfi -t 0.5 -i anullsrc=r=16000:cl=mono \
    -filter_complex '[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]' \
    -map '[out]' -ar 16000 -ac 1 "$path" || return 1
  rm -f "${path%.wav}.aiff"
}

transcribe() {
  local container_path="$1" lang="$2"
  curl -s -m 120 -X POST http://localhost:8000/transcribe \
    -H 'Content-Type: application/json' \
    -d "{\"audio_path\":\"$container_path\",\"call_id\":\"1\",\"language\":$lang}"
}

echo "=============================================="
echo " MINIMAL PAIRS — vowel length is the only difference"
echo "=============================================="
i=0
for entry in "${PAIRS[@]}"; do
  IFS='|' read -r deva roman gloss <<< "$entry"
  i=$((i + 1))
  wav="$OUT/pair-$i.wav"
  say_to_wav "$deva" "$wav" || { echo "  synthesis failed for $deva"; continue; }

  sa=$(transcribe "/storage/probe/audio/pair-$i.wav" '"sa"' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(repr(d.get("fullText","")).strip())' 2>/dev/null)
  hi=$(transcribe "/storage/probe/audio/pair-$i.wav" '"hi"' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(repr(d.get("fullText","")).strip())' 2>/dev/null)
  auto=$(transcribe "/storage/probe/audio/pair-$i.wav" 'null' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(repr(d.get("fullText","")).strip(), d.get("language"))' 2>/dev/null)

  printf '%-8s %-12s (%-12s)\n' "$deva" "$roman" "$gloss"
  printf '   lang=sa   %s\n' "$sa"
  printf '   lang=hi   %s\n' "$hi"
  printf '   auto      %s\n' "$auto"
done

echo
echo "=============================================="
echo " SHORT PHRASES — does context help?"
echo "=============================================="
j=0
for entry in "${PHRASES[@]}"; do
  IFS='|' read -r deva roman <<< "$entry"
  j=$((j + 1))
  wav="$OUT/phrase-$j.wav"
  say_to_wav "$deva" "$wav" || { echo "  synthesis failed"; continue; }

  sa=$(transcribe "/storage/probe/audio/phrase-$j.wav" '"sa"' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(repr(d.get("fullText","")).strip())' 2>/dev/null)
  hi=$(transcribe "/storage/probe/audio/phrase-$j.wav" '"hi"' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(repr(d.get("fullText","")).strip())' 2>/dev/null)

  printf '%s  (%s)\n' "$deva" "$roman"
  printf '   lang=sa   %s\n' "$sa"
  printf '   lang=hi   %s\n' "$hi"
done
