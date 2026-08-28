General discussion about TIL-AI, rules clarifications, explainers, and peeks behind the scenes.

[Blog content from TIL-2025](http://github.com/til-ai/til-25/wiki/Blog):
1. [Changes to the Qualifiers Leaderboard](https://github.com/til-ai/til-25/wiki/Blog#changes-to-the-qualifiers-leaderboard)
2. [Use of non-original software](https://github.com/til-ai/til-25/wiki/Blog#use-of-non-original-software)

**Contents**
1. [Quality of Life Improvements](#quality-of-life-improvements)
2. [BTS: NLP RAG document generation](#bts-nlp-rag-document-generation)

## Quality of Life Improvements

Due to various shenanigans we won't get into here, we didn't have as much time to overhaul a lot of the competition stuff this year. So we decided to place what little extra time we had into making participant QoL improvements. This meant, among other things:
* automatically doing the previously-optional things for participants in instances
* better support for remote development over SSH
* formal support for downloading competition training data over Google Drive
* writing our own inactivity monitor so it would be better behaved than GCP's built-in one
* improving the `til` helper to add support for building and testing images, in addition to submission

We hardly had time to put the competition itself together, much less make improvements over last year. So we hope you notice and appreciated it!

But also, this is how we respond to your participant feedback. So if you have some concerns or ideas for improvement, please let us know, and we'll do our best to either immediately remedy it or fix it for next year (if, of course, we get to do it again next year). <3

## BTS: NLP RAG document generation

In order to generate these documents with some semblance of factual consistency, we needed to have some kind of underlying ground truth. We didn't trust AI to do a good job at that, and we had to ensure that it didn't draw from any existing worlds, lest we be accused of infringing on someone's copyright. 

So, over a week, we painstakingly wrote (overwhelmingly by hand, mind you, not with AI) a massive ~10,000 word "world bible" describing various details of the fictional universe such as locations, events, characters, technologies, etc. This would serve as the factual basis for which all subsequent documents could eventually be derived. If you're curious about the underlying world bible, ask [our technical lead](mailto:ryan.nah@tribex.co) about it after TIL-AI 2026 is over!