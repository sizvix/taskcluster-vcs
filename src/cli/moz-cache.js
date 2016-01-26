import { Scheduler } from 'taskcluster-client';
import slugid from 'slugid';
import createHash from '../hash';

/*
 * This script is meant to be invoked as:
 *
 *    tc-vcs moz-cache
 *
 * This prepopulates a number of caches used by Mozilla CI.
 *
 */

export default async function main(config, argv) {

    var clones = [
        'https://github.com/walac/gecko-dev',
        'https://github.com/lightsofapollo/build-mozharness',
        'https://hg.mozilla.org/build/mozharness',
        'https://hg.mozilla.org/build/tools',
        'https://hg.mozilla.org/mozilla-central',
        'https://hg.mozilla.org/mozilla-central/',
        'https://hg.mozilla.org/integration/b2g-inbound/',
        'https://hg.mozilla.org/integration/b2g-inbound',
        'https://hg.mozilla.org/integration/mozilla-inbound',
        'https://hg.mozilla.org/integration/mozilla-inbound/',
        'https://hg.mozilla.org/integration/gaia',
        'https://hg.mozilla.org/integration/gaia/',
        'https://hg.mozilla.org/integration/gaia-2_5',
        'https://hg.mozilla.org/integration/gaia-2_5/',
        'https://hg.mozilla.org/integration/gaia-2_2r',
        'https://hg.mozilla.org/integration/gaia-2_2r/',
        'https://hg.mozilla.org/integration/fx-team/',
        'https://hg.mozilla.org/integration/fx-team',
        'https://git.mozilla.org/b2g/B2G.git',
        'https://hg.mozilla.org/integration/gaia-central',
        'https://hg.mozilla.org/integration/gaia-central/',
        'https://git.mozilla.org/b2g/B2G',
        'https://github.com/mozilla-b2g/gaia',
        'https://github.com/mozilla-b2g/B2G',
        'https://github.com/mozilla-b2g/B2G-manifest',
        'https://github.com/mozilla-b2g/moztt',
        'https://github.com/mozilla/gecko-dev',
        'https://git.mozilla.org/build/tooltool.git',
        'https://git.mozilla.org/external/google/gerrit/git-repo.git',
        'https://hg.mozilla.org/projects/alder',
        'https://hg.mozilla.org/projects/alder/',
        'https://hg.mozilla.org/releases/mozilla-b2g34_v2_1',
        'https://hg.mozilla.org/releases/mozilla-b2g34_v2_1/',
        'https://hg.mozilla.org/releases/mozilla-b2g37_v2_2r',
        'https://hg.mozilla.org/releases/mozilla-b2g37_v2_2r/',
        'https://hg.mozilla.org/releases/mozilla-b2g37_v2_2r/',
        'https://hg.mozilla.org/releases/mozilla-b2g44_v2_5',
        'https://hg.mozilla.org/releases/mozilla-b2g44_v2_5/'
    ];


    var emulators = [
        ['emulator_url', 'emulator-ics'],
        ['emulator_url', 'emulator'],
        ['emulator_url', 'emulator-jb'],
        ['emulator_url', 'emulator-kk'],
        ['emulator_url', 'aries'],
        ['emulator_url', 'flame'],
        ['emulator_url', 'flame-kk'],
        ['emulator_url', 'nexus-4'],
        ['emulator_url', 'emulator-l'],
        ['emulator_url', 'dolphin']
    ];

    var scheduler = new Scheduler({
        // for use with taskclusterProxy
        baseUrl: 'taskcluster/scheduler/v1'
    });
    var tasks = [];

    for (var url of clones) {
        tasks.push(generateCloneTaskDefinition(url));
    }

    for (var emulator of emulators) {
        tasks.push(generateRepoCacheTaskDefinition(emulator[1], emulator[0]));
    }


    let {graphId, graph} = generateCacheGraph(tasks);
    console.log(`Creating cache graph '${graphId}'`);
    console.log(JSON.stringify(graph));

    let result = await scheduler.createTaskGraph(graphId, graph);
    console.log(JSON.stringify(result));
}


// To configure, define in your environment:
//   OWNER_EMAIL
//   TASKCLUSTER_ACCESS_TOKEN
//   TASKCLUSTER_CLIENT_ID
//
// Notes:
// * Only supports a workerType with permacreds at this time.

function generateCacheGraph(tasks) {
  let graphId = slugid.nice();

  let client_id = '';
  if (process.env.TASK_ID) {  // we're running in docker-worker in TaskCluster prod
      client_id = 'hook-id:taskcluster/tc-vcs-refresh';
  } else {
      client_id = 'client-id:' + process.env.TASKCLUSTER_CLIENT_ID;
  } // TODO maybe should just totally bail at this point

  let graph = {
      metadata: {
        name:         'Clone Cache Graph',
        description:  'Creates cached copies of repositories to use with taskcluster-vcs',
        owner:        process.env.OWNER_EMAIL || "selena@mozilla.com",
        source:       'https://github.com/taskcluster/taskcluster-vcs'
      },
      scopes: ['assume:' + client_id]
  }

  graph.tasks = tasks.map((task) => {
    return {
      taskId: slugid.nice(),
      task: task
    }
  })

  return {graphId, graph};
}

function setDeadline(date, hoursFromNow) {
    date.setHours(date.getHours() + hoursFromNow);
    return date;
}

function generateCloneTaskDefinition(repo) {

    var date = new Date();
    var deadline = setDeadline(new Date(date.getTime()), 4);
    var params = ['create-clone-cache', '--force-clone', '--upload', '--proxy', repo]

    var task = {
      provisionerId: 'aws-provisioner-v1',
      workerType: 'gaia',
      created: date,
      deadline: deadline,
      scopes: ['queue:create-artifact:*', 'index:insert-task:tc-vcs.v1.clones.*'],
      payload: {
        image: 'taskcluster/taskcluster-vcs:2.3.26',
        command: params,
        maxRunTime: 3600,
        features: {
          taskclusterProxy: true
        },
        env: {
          DEBUG: '*'
        }
      },
      metadata: {
        name: `cache ${repo}`,
        description: params.join(' '),
        owner: process.env.OWNER_EMAIL || "selena@mozilla.com",
        source: 'https://github.com/taskcluster/taskcluster-vcs'
      }
    };

    return task;

}

function generateRepoCacheTaskDefinition(emulator, type) {
    var date = new Date();
    var deadline = setDeadline(new Date(date.getTime()), 4);
    var repo = '';
    var B2GUrl = 'https://git.mozilla.org/b2g/B2G';

    if (type === 'emulator_url') {
        repo = ["http://hg.mozilla.org/mozilla-central/raw-file/default/b2g/config", emulator, "sources.xml"].join('/');
    } else if (type === 'g_emulator_url') {
        repo = ["https://raw.githubusercontent.com/mozilla-b2g/b2g-manifest/master", emulator].join('/');
    } else {
        throw `Type ${type} is invalid.`
    }
    var params = ['create-repo-cache', '--force-clone', '--upload', '--proxy', B2GUrl, repo]
    // Use a hash that is unique enough to not overwrite other repos that are cached
    // This hash is used primarily for looking up the parent task that created
    // 'repo' caches and indexed them.
    var indexHash = createHash(`repo-cache-${B2GUrl}-${emulator}`);

    var task = {
      provisionerId: 'aws-provisioner-v1',
      workerType: 'tcvcs-cache-device',
      created: date,
      deadline: deadline,
      scopes: ['queue:create-artifact:*', 'index:insert-task:tc-vcs.v1.repo-project.*'],
      routes: [`index.tc-vcs.v1.repo-project.${indexHash}`],
      payload: {
        image: 'taskcluster/taskcluster-vcs:2.3.26',
        command: params,
        maxRunTime: 3600,
        features: {
          taskclusterProxy: true
        },
        env: {
          DEBUG: '*'
        }
      },
      metadata: {
        name: `cache ${emulator}`,
        description: params.join(' '),
        owner: process.env.OWNER_EMAIL || "selena@mozilla.com",
        source: 'https://github.com/taskcluster/taskcluster-vcs'
      }
    };

    return task;
}