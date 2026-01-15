import { deployDiamond } from './deploy-diamond'
import * as path from 'path'

async function main() {
  const args = process.argv.slice(2)
  const withInit = args.includes('--init') || args.includes('-i') || process.env.DEPLOY_INIT === 'true'

  await deployDiamond({
    withInit,
    environment: 'local'
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })

