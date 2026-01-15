"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, FileJson, Key, Signature, Database } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"

export default function ConceptsPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">{t("docs.nav.documentation")}</Link>
        <span>/</span>
        <Link href="/docs/introduction" className="hover:text-foreground">{t("docs.nav.introduction")}</Link>
        <span>/</span>
        <span className="text-foreground">{t("docs.nav.concepts")}</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{t("docs.concepts.title")}</h1>
        <p className="text-xl text-muted-foreground">
          {t("docs.concepts.subtitle")}
        </p>
      </div>

      {/* VC */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FileJson className="h-5 w-5 text-blue-500" />
          </div>
          <h2 className="text-2xl font-semibold" id="verifiable-credential">
            {t("docs.concepts.vc.title")}
          </h2>
        </div>
        
        <p className="text-muted-foreground">
          {t("docs.concepts.vc.description")}
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 py-3">
            <CardTitle className="text-sm font-mono">{t("docs.concepts.vc.structure")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "UniversityDegree"],
  "issuer": "did:ethr:0x1234...abcd",
  "issuanceDate": "2024-01-15T00:00:00Z",
  "credentialSubject": {
    "id": "did:ethr:0x5678...efgh",
    "degree": {
      "type": "BachelorDegree",
      "name": "Ingeniería Informática",
      "university": "Universidad de Madrid"
    }
  },
  "proof": {
    "type": "EIP712Signature2021",
    "verificationMethod": "did:ethr:0x1234...abcd#keys-1",
    "proofValue": "0x..."
  }
}`}
            </pre>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-lg border bg-card">
            <Badge variant="outline" className="mb-2">@context</Badge>
            <p className="text-sm text-muted-foreground">
              {t("docs.concepts.vc.fields.context")}
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <Badge variant="outline" className="mb-2">credentialSubject</Badge>
            <p className="text-sm text-muted-foreground">
              {t("docs.concepts.vc.fields.subject")}
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <Badge variant="outline" className="mb-2">issuer</Badge>
            <p className="text-sm text-muted-foreground">
              {t("docs.concepts.vc.fields.issuer")}
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <Badge variant="outline" className="mb-2">proof</Badge>
            <p className="text-sm text-muted-foreground">
              {t("docs.concepts.vc.fields.proof")}
            </p>
          </div>
        </div>
      </section>

      {/* VP */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Signature className="h-5 w-5 text-green-500" />
          </div>
          <h2 className="text-2xl font-semibold" id="verifiable-presentation">
            {t("docs.concepts.vp.title")}
          </h2>
        </div>

        <p className="text-muted-foreground">
          {t("docs.concepts.vp.description")}
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 py-3">
            <CardTitle className="text-sm font-mono">{t("docs.concepts.vp.structure")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiablePresentation"],
  "holder": "did:ethr:0x5678...efgh",
  "verifiableCredential": [
    { /* VC completa */ }
  ],
  "proof": {
    "type": "EIP712Signature2021",
    "challenge": "abc123...",
    "domain": "verifier.example.com",
    "proofValue": "0x..."
  }
}`}
            </pre>
          </CardContent>
        </Card>

        <div className="p-4 rounded-lg bg-muted/50 border">
          <h4 className="font-medium mb-2">{t("docs.concepts.vp.whyUse.title")}</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>{t("docs.concepts.vp.whyUse.privacy.title")}:</strong> {t("docs.concepts.vp.whyUse.privacy.description")}</li>
            <li>• <strong>{t("docs.concepts.vp.whyUse.freshness.title")}:</strong> {t("docs.concepts.vp.whyUse.freshness.description")}</li>
            <li>• <strong>{t("docs.concepts.vp.whyUse.binding.title")}:</strong> {t("docs.concepts.vp.whyUse.binding.description")}</li>
          </ul>
        </div>
      </section>

      {/* DID */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Key className="h-5 w-5 text-purple-500" />
          </div>
          <h2 className="text-2xl font-semibold" id="did">
            {t("docs.concepts.did.title")}
          </h2>
        </div>

        <p className="text-muted-foreground">
          {t("docs.concepts.did.description")}
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 py-3">
            <CardTitle className="text-sm font-mono">{t("docs.concepts.did.format")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="font-mono text-sm">
              <span className="text-blue-500">did</span>
              <span className="text-muted-foreground">:</span>
              <span className="text-green-500">ethr</span>
              <span className="text-muted-foreground">:</span>
              <span className="text-purple-500">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</span>
            </div>
            <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
              <span><span className="text-blue-500">●</span> Scheme</span>
              <span><span className="text-green-500">●</span> Method</span>
              <span><span className="text-purple-500">●</span> Method-specific ID (address)</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* EIP-712 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Database className="h-5 w-5 text-orange-500" />
          </div>
          <h2 className="text-2xl font-semibold" id="eip712">
            {t("docs.concepts.eip712.title")}
          </h2>
        </div>

        <p className="text-muted-foreground">
          {t("docs.concepts.eip712.description")}
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-red-500">{t("docs.concepts.eip712.without.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded bg-muted font-mono text-xs">
                Sign message:<br/>
                0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("docs.concepts.eip712.without.description")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-500">{t("docs.concepts.eip712.with.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded bg-muted font-mono text-xs">
                Sign Credential:<br/>
                - Type: UniversityDegree<br/>
                - Subject: 0x5678...efgh<br/>
                - Degree: Ingeniería Informática
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("docs.concepts.eip712.with.description")}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link 
          href="/docs/introduction" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("docs.nav.introduction")}
        </Link>
        <Link 
          href="/docs/architecture/overview" 
          className="flex items-center gap-2 text-primary hover:underline"
        >
          {t("docs.nav.overview")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
