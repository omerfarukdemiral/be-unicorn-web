// Balance simulator entry (engine lane fills this: 4 archetype bots → report). PLAN §8.3.
import { Rng, createRngState } from '../src/engine/rng'
import { STAGES } from '../src/content/stages'

const rng = new Rng(createRngState(1))
console.log(`Be Unicorn sim — ${STAGES.length} aşama tanımlı, rng örneği: ${rng.next().toFixed(4)}`)
console.log('Engine henüz bağlı değil; arketip botları engine şeridinde eklenecek.')
