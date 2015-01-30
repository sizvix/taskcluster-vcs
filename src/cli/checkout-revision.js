import { ArgumentParser } from 'argparse';
import detectLocal from '../vcs/detect_local'

export default async function main(config, argv) {
  let parser = new ArgumentParser({
    prog: 'tc-vcs checkout-revision',
    version: require('../../package').version,
    addHelp: true,
    description: 'Checkout a revision (potentially from a remote)'
  });

  parser.addArgument(['path'], {
    help: 'Repository which to operate on'
  });

  parser.addArgument(['repository'], {
    help: 'Repository to pull from'
  });

  parser.addArgument(['ref'], {
    help: 'Reference (this can be a real ref / branch/ revision)'
  });

  parser.addArgument(['revision'], {
    help: 'revision'
  });

  let args = parser.parseArgs(argv);
  let vcsConfig = await detectLocal(args.path);
  let vcs = require('../vcs/' + vcsConfig.type);
  await vcs.checkoutRevision(
    config, args.path, args.repository, args.ref, args.revision
  );
}
