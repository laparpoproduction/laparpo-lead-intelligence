import { companyIntelligenceSchema } from "./company-intelligence.schema";
import { validateCompanyIntelligenceEvidence } from "./company-intelligence.evidence";
import { buildCompanyIntelligenceRequest } from "./company-intelligence.prompt";
import { renderCompanyIntelligence } from "./company-intelligence.render";
import type {
  CompanyIntelligence,
  CompanyIntelligenceModel,
  CompanyIntelligenceProjection,
  CompanyIntelligenceProvider,
  CompanyIntelligenceUsage,
} from "./company-intelligence.types";

export class InvalidCompanyIntelligenceOutputError extends Error {
  constructor() {
    super("Company intelligence provider returned invalid output");
    this.name = "InvalidCompanyIntelligenceOutputError";
  }
}

export type GenerateCompanyIntelligenceResult = {
  intelligence: CompanyIntelligence;
  model: CompanyIntelligenceModel;
  usage: CompanyIntelligenceUsage | null;
};

export class CompanyIntelligenceService {
  constructor(
    private readonly provider: CompanyIntelligenceProvider,
    private readonly model: CompanyIntelligenceModel,
  ) {}

  async generate(
    company: CompanyIntelligenceProjection,
  ): Promise<GenerateCompanyIntelligenceResult> {
    const response = await this.provider.generate(
      buildCompanyIntelligenceRequest(company, this.model),
    );
    const parsed = companyIntelligenceSchema.safeParse(response.output);
    if (!parsed.success) throw new InvalidCompanyIntelligenceOutputError();

    let grounded;
    try {
      grounded = validateCompanyIntelligenceEvidence(company, parsed.data);
    } catch {
      throw new InvalidCompanyIntelligenceOutputError();
    }

    return {
      intelligence: renderCompanyIntelligence(company, grounded),
      model: this.model,
      usage: response.usage,
    };
  }
}
