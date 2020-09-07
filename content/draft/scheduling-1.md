+++
title = "(DRAFT) ECS scheduler thoughts, part 1"
date = 2020-09-01

[taxonomies]
#categories = ["Articles"]
#tags = ["ECS", "Scheduling", "Rust"]
+++

Part 1 covers... TODO

<!-- more -->

*This article is written within the context of Rust language ecosystem and
describes concepts mostly relevant to ECS (entity-component-system).
However, no knowledge of the ECS paradigm, Rust's ecosystem, or even Rust
language is necessary for understanding its ideas and conclusions.*

# What is a scheduler?

Behavior of an ECS program is described by one or several "systems" -
the "S" part of ECS - functions that operate on the data contained within
the "EC" part.
ECS paradigm is used almost exclusively in the context of game and engine
programming, with some set of systems the program contains normally running
every "frame" - a pre-determined time interval, not necessarily tied to the
video frame rate of the game.
The amount of time required for all systems in a set to finish their work for
the frame can be referred to as [makespan][makespan] of the set.

[makespan]: https://en.wikipedia.org/wiki/Makespan

The time a single system needs to be done for the frame is usually not known
beforehand, because it often scales with the data the system operates on.
Said data can change at runtime, often through user input.

For performance's sake - to minimize the makespan - it's sometimes desirable to
have several of these systems executed at the same time, in parallel.
However, in practice systems often operate on intersecting sets of data,
which necessitates the use of some kind of synchronization mechanism.

Said mechanism can't be a simple lock over the data, since that would force the
execution of systems to be sequential.
It can be several orthogonal locks, but that's not the most performant approach,
and runs the risk of deadlocking in a naive implementation.

A more popular solution is to employ a special algorithm - a "scheduler" -
that queues systems to run in a way that has better utilization of processing
resources (read: threads) than running them sequentially, yet doesn't violate
data access rules without the need for locks.
(In Rust these rules state that data may be changed from only one place
at a time, and data that may be changed elsewhere cannot be read.)
The problem of finding such an algorithm is closely related to the
[multiprocessor scheduling][MPS] problem; finding the optimal schedule for the
systems is NP-hard.

[MPS]: https://en.wikipedia.org/wiki/Multiprocessor_scheduling

In this article, two systems are described as disjoint if running them in
parallel would not violate access rules.
If the rules would be violated, the systems are intersecting.

Disjointedness is not necessarily transitive. Example:

* system `0` with required resource `A`
* system `1` with `B`
* system `2` with `A`

Systems `0` and `1` are disjoint, systems `1` and `2` are disjoint, yet `0` and
`2` intersect.

Likewise, intersection is also not necessarily transitive. Example:

* system `0` with required resource `A`
* system `1` with `A` and `B`
* system `2` with `B`

Systems `0` and `1` intersect, systems `1` and `2` intersect, yet `0` and `2`
are disjoint.

# Static schedule

The first idea is to generate an execution schedule once, when the scheduler is
first defined and populated.
Even if doing so is NP-hard, it's not a constant cost, seeing as changes to the
set of active systems are comparatively rare, if there are any at all.

One way or another, a sequence of sets of disjoint systems is produced; when
the schedule is executed, sets are iterated sequentially, and systems within
them are ran in parallel.
This can be modeled as a directed acyclic graph (DAG), where nodes are the
implicit synchronization points between the sets, and edges are the systems
and connect the points in such a way that edges originating in one node all
terminate in the same other node.

Since the run time of a system is usually not known at the point of schedule
creation, the schedule has to assume that all systems take equally as long.
There is an obvious problem: run times are in no way guaranteed to be equal,
and often independently change during the program's operation.
This almost inevitably produces a situation where some systems in a disjoint
set take longer than the rest, reducing average resource utilization.

The scheduler could ask its user to provide hints for the system run time.
This, obviously, puts a tremendous additional workload on the user - it requires
them to anticipate all factors that might influence the run time.
A framework could be built that, using specially-designed stress tests,
"learns" (as in, machine learning) the time coefficients of a given program;
the coefficients are later baked into the distributed binary's schedulers.
Such approach is likely only feasible for specific projects, with relatively
stable coefficients (and enough budget for shouldering the computational cost
of the process).

Alternatively, the scheduler could collect the run times of systems during
execution, picking up any changes, and adjusting the schedule to maximize
utilization on the fly.
Potential volatility of the run time could thwart this approach: if a system
is recorded to take some amount of time to finish during this frame, it's not
guaranteed to not take a vastly different amount next frame, when the
measurement is actually used (in practice, persistently high volatility
between frames is uncommon).

The feasibility of static schedulers is further undermined by requirements of
certain kinds of ECS, most notably archetypal ECS - a subtype distinct in the
way it organizes data internally.
Without going into specifics: sometimes when the data in such an ECS changes
it also changes which systems are disjoint.
To address that, the scheduler must partially rebuild its execution graph
whenever such a change occurs.
(Technically, it could also ignore this avenue for parallelization and instead
rely only on statically provable disjointedness; however, that still leaves it
with the unknown time problem.)

# Dynamic "schedule"

The idea of tweaking the schedule on the fly can be taken much further:
a scheduler could retain no static execution graph at all.

It would, instead, start execution of whichever system, then find another one
that is disjoint with the one now running, then another that is disjoint with
the two now running...
Once no systems can be started the scheduler simply waits for one of them to
finish; as soon as that happens, it checks again if more systems can now start.

This eliminates the biggest problem stemming from unknown run time of systems:
there are no implicit synchronization points, systems start as soon as
resources are available (access and threads).

However, the order in which systems start matters. Example:

* systems `0`, `1`, `2`, and `3`
* `2` intersects `0` and `1`
* `3` intersects `1`

If `0` and `1` are started first, `2` can start after both of them finish,
and `3` can start as soon as `0` finishes; `2` and `3` can run concurrently.

If `0` and `3` are started first, `1` can start after `3` finishes, and `2`
can start after `0` finishes, but they can't run concurrently.

{% katex(block=true) %}
\infty
\KaTeX
\infty
{% end %}

This means that, on paper, a naive dynamic scheduler cannot be said to improve
the makespan for all cases.
In practice, it tends to win against any time-agnostic static scheduler as soon
as there's the slightest discrepancy between system run times.

# Execution order

In some cases it's necessary to have an explicit execution order between two
individual systems.
A system might be processing events generated in another system - not ensuring
that the consumer runs after the producer may lead to one frame of delay in the
event resolution; if there's a whole chain of systems depending on each other's
output, the worst case for the delay will be as many frames as there are systems
in said chain.
Obviously, no cycles may exist in these dependencies for the systems graph to
be executable.

Presence of explicit ordering between however many of the systems greatly
exacerbates the problem of having a schedule in the first place.
A static scheduler can accomplish this by sorting a dependent system into a
disjoint set that is executed after the sets containing its dependencies.
A dynamic scheduler can maintain a list of systems that have all their
dependencies satisfied and only execute systems from that list, updating it
every time a system with dependents finishes.



Sometimes, system insertion order has to be different from system execution order.
Example: a plugin adds a system that processes some kind of events, a different
plugin depends on the first one being initialized and adds a system that produces
said kind of events.

Sometimes, this dependency cannot be inferred from the systems' borrows
(the resources and components/archetypes they access). Example: an item pickup
system that writes pickup events to a channel sender, and a score system that
increments player score based on the pickup events it reads from the
channel receiver; one could get clever and give them a common type to let
the schedule infer a dependency, but that, to me, is a counter-intuitive
and unergonomic workaround.

The current solution to this is stages: groups of systems that have a set
execution order between themselves, and inferred execution order of individual
systems within each group.

# Why stages alone are not good enough

As example, consider such a game:
- thread pool with several threads for crunching ECS
- systems `0`, `1`, `2`, `3`, and `4`, none of which can have
batched (parallel) iteration (for simplicity's sake)
- the systems don't have any incompatible borrows
(it's not a stretch to have many systems with orthogonal borrows)
- `0` and `1` don't depend on any other system
- `2` depends on both `0` and `1`
- `3` depends on `2`
- `4` depends on `0`

With stages, this can be expressed like this:
- Stage 0: systems `0` and `1` are executed
- Stage 1: systems `2` and `4` are executed
- Stage 2: system `3` is executed

System `4` can be moved around, including into its own stage,
but these permutations are either equivalent or worse.
What if `4` executes several times slower than `2`?
In the configuration above, system `3` will be waiting until `4` finishes,
despite being completely independent of it; same story with `4` waiting on `1`.
Moreover, there are at most two threads in use.

Another example:
- thread pool with 16 threads
- systems `0`, `1`, `2`, and `s_1` through `s_N`
- `0` doesn't depend on any system
- `1` and `2` depend on `0`

# Summary
TODO not here
1. Stages should be used to express execution order between groups
of systems, not individual systems.
2. There should be a mechanism to express optional execution order between
individual systems in a stage.
3. Systems within a stage should be allowed to run opportunistically, i.e.,
whenever there are available resources (borrows and a thread) and no
unsatisfied execution order dependencies.