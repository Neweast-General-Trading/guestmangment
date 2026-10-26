import json
import sys

from gtts import gTTS


def main():
    lines = json.loads(sys.argv[1])
    folder = sys.argv[2]
    lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    for i, text in enumerate(lines):
        if lang == "en":
            gTTS(text, lang="en", tld="co.uk").save(f"{folder}/{i:03d}.mp3")
        else:
            gTTS(text, lang=lang).save(f"{folder}/{i:03d}.mp3")


main()
