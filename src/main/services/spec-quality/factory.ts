import { SpecQualityService } from './spec-quality-service'
import { SpecParser } from './spec-parser'
import { RequiredSectionsValidator } from './validators/required-sections-validator'
import { FilePathsValidator } from './validators/file-paths-validator'
import { NumberedStepsValidator } from './validators/numbered-steps-validator'
import { BannedPhrasesValidator } from './validators/banned-phrases-validator'
import { SizeWarningsValidator } from './validators/size-warnings-validator'

/** Composition root — only place concrete class names appear outside tests */
export function createSpecQualityService(): SpecQualityService {
  return new SpecQualityService(
    new SpecParser(),
    [
      new RequiredSectionsValidator(),
      new FilePathsValidator(),
      new NumberedStepsValidator(),
      new BannedPhrasesValidator(),
      new SizeWarningsValidator(),
    ],
    [] // async validators added in next task
  )
}
