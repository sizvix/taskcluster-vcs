import rm from './rm';
import run from './run';
import fs from 'mz/fs';
import assert from 'assert';
import mkdirp from 'mkdirp';
import cloneCache from './clone_cache';

suite('clone', function() {
  async function clean() {
    await rm('./clones/');
    mkdirp.sync(__dirname + '/clones');
  }

  teardown(clean);
  setup(clean);

  test('hg', async function() {
    let dest = __dirname + '/clones/hg';
    let out = await run([
      'clone',
      'https://bitbucket.org/lightsofapollo/hgtesting',
      dest
    ]);
    assert((await fs.exists(dest)), 'path exists');
    let rev = await run(['revision', dest]);
    assert.equal(rev[0], '5d3acb7ef08f1c988b6f34ade72718a10a6ac123');
  });

  test('git', async function () {
    let dest = __dirname + '/clones/git';
    await run([
      'clone',
      'https://bitbucket.org/lightsofapollo/gittesting',
      dest
    ]);
    assert((await fs.exists(dest)), 'path exists');
    let rev = await run(['revision', dest]);
    assert.equal(rev[0], '3d8bd58cddfa558b78e947ed04ad8f9a3359ed73');
  });

  test('cached', async function () {
    let url = 'https://github.com/lightsofapollo/tc-vcs-cache';
    let [namespace] = await cloneCache(url);
    async function testCache (dest) {
      await run([
        'clone',
        '--namespace', namespace,
        url,
        dest
      ]);

      assert((await fs.exists(dest)), 'path exists');
      let rev = await run(['revision', dest]);
      let cachePath = __dirname + '/../cache/' +
                      'clones/github.com/lightsofapollo/tc-vcs-cache.tar.gz';

      assert.ok((await fs.exists(cachePath)), 'cache was correctly downloaded');
    }

    // Run and rerun the cache a few times to see what happens!
    await testCache(__dirname + '/clones/cache-1');
    await testCache(__dirname + '/clones/cache-2');
    await testCache(__dirname + '/clones/cache-3');
  });
});
