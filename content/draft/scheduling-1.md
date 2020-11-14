+++
title = "ECS scheduler thoughts, part 1"
date = 2020-11-14

[taxonomies]
#tags = ["ECS", "scheduler", "Rust"]
+++

An overview of the ECS system scheduling problem, the constraints a
prospective solution should consider, and a pair of algorithm examples.

<!-- more -->

*This article is written within the context of Rust language ecosystem and
describes concepts mostly relevant to ECS (entity-component-system).
However, no knowledge of the ECS paradigm, Rust's ecosystem, or even Rust
language is necessary for understanding its ideas and conclusions.*

# What is a scheduler?

Behavior of an ECS program is described by one or several "systems" -
the "S" part of ECS - functions that operate on the shared data contained within
the "EC" part.
ECS paradigm is used almost exclusively in the context of game and engine
programming, with some set of systems the program contains normally running
every "frame" - a pre-determined time interval, not necessarily tied to the
video frame rate.
The amount of time required for all systems in a set to finish their work for
the frame can be referred to as [makespan][makespan] of the set.

[makespan]: https://en.wikipedia.org/wiki/Makespan

The time a single system needs to be done for the frame is usually not known
beforehand, because it often scales with the data the system operates on.
Said data can change at runtime, often through user input.

For performance's sake - to minimize the makespan - it's sometimes desirable to
have several of these systems executed at the same time, in parallel.
In practice, however, systems often operate on intersecting sets of data,
which necessitates the use of some kind of synchronization mechanism.

Said mechanism can't be a simple lock over the shared data, since that would
force the execution of systems to be sequential.
It can be several orthogonal locks, but that's not the most performant approach,
and runs the risk of deadlocking in a naive implementation.

A more popular solution is to employ a special algorithm - a "scheduler" -
that queues systems to run in a way that has better utilization of processing
resources (read: threads, since a thread can be running only one system at
a time) than running them sequentially, yet doesn't violate data access rules
without the need for locks.
(In Rust these rules state that data may be changed from only one place
at a time, and data that may be changed elsewhere cannot be read.)
The problem of finding such an algorithm is closely related to the
[multiprocessor scheduling][MPS] problem; finding the optimal schedule for the
systems is always NP-hard.

[MPS]: https://en.wikipedia.org/wiki/Multiprocessor_scheduling

For an ECS program to be schedulable it needs to be executable at least
sequentially, i.e. whatever constraints on system order execution it might have
must not contain cycles of dependencies - the systems must form an acyclic
[disjunctive graph](https://en.wikipedia.org/wiki/Disjunctive_graph).
Execution order will be elaborated upon further in the article; for now, the
set {{katex(body="\Pi")}} will be said to contain all such programs:
{% katex(block=true) %}
    \Pi = \{ P | P \text{ is executable} \}.
{% end %}

An ECS program {{katex(body="P \in \Pi")}} consisting of {{katex(body="n")}}
systems is further defined as such:
{% katex(block=true) %}
    P \stackrel{\mathrm{def}}{=} \{s_0, s_1, ..., s_n |
    s_i \stackrel{\mathrm{def}}{=} (t_i, d_i) \},
{% end %}
where {{katex(body="s_i")}} is an individual system, {{katex(body="t_i")}}
is the time it needs to complete its work, and {{katex(body="d_i")}}
is the set of data it operates on. Then, a scheduling
algorithm {{katex(body="sched")}} is a mapping of {{katex(body="P")}} to
some schedule {{katex(body="S")}}:
{% katex(block=true) %}
    sched: \forall P \in \Pi, P \stackrel{sched}{\mapsto} S.
{% end %}

The makespan {{katex(body="M_{opt}")}} is the optimal makespan for a
given {{katex(body="P")}}, {{katex(body="M_S")}} is the makespan
of {{katex(body="S")}}, and {{katex(body="M_{seq}")}} is the practical
worst-case makespan of executing all systems of {{katex(body="P")}} in
sequence:
{% katex(block=true) %}
    M_{seq} = \sum_{i=0}^{n} t_i.
{% end %}

The problem then can be stated as finding
{% katex(block=true) %}
    sched: \forall P \in \Pi, P \stackrel{sched}{\mapsto} S,
    M_S \le M_{seq}, M_S \to M_{opt},
{% end %}
and, ideally,
{% katex(block=true) %}
    sched \notin \text{NP}.
{% end %}

In this article, two systems are described as disjoint if running them in
parallel would not violate access rules,
i.e. {{katex(body="
    {s_i, s_j} \in P, i \mathrel{\char8800} j,
    d_i \cap d_j = \emptyset
")}}.
If the rules would be violated, the systems are intersecting,
i.e. {{katex(body="
    {s_i, s_j} \in P, i \mathrel{\char8800} j,
    d_i \cap d_j \mathrel{\char8800} \emptyset
")}}.

Disjointedness is not necessarily transitive. Example:

* system `0` with required access to `A`
* system `1` with `B`
* system `2` with `A`

Systems `0` and `1` are disjoint, systems `1` and `2` are disjoint, yet `0` and
`2` intersect; or, {{katex(body="
    d_0 \cap d_1 = \emptyset,
    d_1 \cap d_2 = \emptyset,
    d_0 \cap d_2 \mathrel{\char8800} \emptyset
")}}.

Likewise, intersection is also not necessarily transitive. Example:

* system `0` with required access to `A`
* system `1` with `A` and `B`
* system `2` with `B`

Systems `0` and `1` intersect, systems `1` and `2` intersect, yet `0` and `2`
are disjoint; or, {{katex(body="
    d_0 \cap d_1 \mathrel{\char8800} \emptyset,
    d_1 \cap d_2 \mathrel{\char8800} \emptyset,
    d_0 \cap d_2 = \emptyset
")}}.

# Static schedule

The first instinct is to generate an execution schedule once, when the scheduler
is first defined and populated.
Even if doing so is NP-hard, it wouldn't be a constant cost, seeing as changes
to {{katex(body="P")}} are comparatively rare in practice, if there are any
at all.

One way or another, a sequence of sets of disjoint systems is produced; when
the schedule is executed, sets are iterated sequentially, and systems within
them are ran in parallel.
This can be thought of as a directional acyclic graph where nodes are the
implicit synchronization points between the sets, and edges are the systems and
connect the points in such a way that edges originating in one node all
terminate in the same other node.
Formally:
{% katex(block=true) %}
    stat \equiv sched_{static}, \newline
    stat : \forall P \in \Pi, P \stackrel{stat}{\mapsto} S_{stat}, \newline
    S_{stat} = \{ \sigma | \sigma = \{ s |  \forall {s_i, s_j} \in \sigma,
    i \mathrel{\char8800} j, d_i \cap d_j = \emptyset \} \}.
{% end %}

Since the run time of a system is usually not known at the point of schedule
creation, the schedule has to assume that all systems take equally as long.
There is an obvious problem: run times are in no way guaranteed to be equal,
and often independently change during the program's operation.
This almost inevitably produces a situation where some systems in a disjoint
set take longer than the rest, reducing average resource utilization.

Assuming sufficient processing resources (all systems in a
set {{katex(body="\sigma")}} can run in parallel at full performance),
the best-case makespan {{katex(body="M_{stat}")}} of {{katex(body="S_{stat}")}}
is the sum of {{katex(body="t")}} of the longest-running system in each
disjoint set:
{% katex(block=true) %}
    M_{stat} = \sum_{\sigma \in S_{stat}} \max_{s_i \in \sigma}(t_i).
{% end %}
Trivially, if all systems of {{katex(body="P")}} are disjoint:
{% katex(block=true) %}
    \forall {s_i, s_j} \in P, i \mathrel{\char8800} j,
    d_i \cap d_j = \emptyset, \newline
    S_{stat} \equiv S_{par}, M_{par} = \max_{s_i \in P}(t_i) \approx M_{opt}.
{% end %}
(Naturally, all correct scheduling algorithms should be able to
produce {{katex(body="S_{par}")}} when applied to such {{katex(body="P")}}.)

The first idea for alleviating the unknown time problem is to make the
time known.

The scheduler could ask its user to provide hints for the system run time,
be it manually, or via some automated benchmark framework.
However, anticipating all factors that might influence the run time is
impractical for most projects, so this approach would be feasible only for
programs with well-behaved, predictable time coefficients.

Alternatively, the scheduler could collect the run times of systems during
execution, picking up on any changes, and adjusting the schedule to maximize
utilization on the fly (making "static" a misnomer).
Potential volatility of the run time could thwart this approach: if a system
is recorded to take some amount of time to finish during this frame, it's not
guaranteed to not take a vastly different amount next frame, when the
measurement is actually used (in practice, persistently high volatility
between frames is uncommon).

The feasibility of pure {{katex(body="stat")}} is further undermined by
requirements of certain kinds of ECS, most notably archetypal ECS - a subtype
distinct in the way it organizes data internally.
Without going into specifics: sometimes when the data in such an ECS changes
it also changes which systems are disjoint (this is what the phrase "world's
archetypes have changed" in the examples later in the article refers to).
To address that, the scheduler must partially rebuild its execution graph
whenever such a change occurs.
(Technically, it could also ignore this avenue for parallelization and instead
rely only on statically provable disjointedness; however, that still leaves it
with the unknown time problem.)

# Dynamic "schedule"

The idea of tweaking the schedule on the fly can be taken much further:
a scheduler could retain no static execution graph at all.

Such {{katex(body="dyn \equiv sched_{dynamic}")}} would, instead, start
execution of whichever system, then find another one that is disjoint with
the one now running, then another that is disjoint with the two now running...
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
and `3` can start as soon as `0` finishes; `2` and `3` can run in parallel.

If `0` and `3` are started first, `1` can start after `3` finishes, and `2`
can start after `0` finishes, but they can't run in parallel.

This implies that a naive {{katex(body="dyn")}} implementation cannot be said
to always produce an optimal schedule.

# Practical considerations

An important but not yet elaborated upon property of
any {{katex(body="sched")}} can be gleaned from its definition: it needs to
work for all {{katex(body="P \in \Pi")}}.
In practice, these programs often impose additional requirements, which may
narrow the search space (the amount of valid schedules) the algorithm has to
contend with by constraining some of their systems to certain positions in the
schedule.

While these constraints may reduce the running time
of {{katex(body="sched")}} itself, reducing the search space can potentially
exclude the optimal schedule, which, coupled with the fact that no constraint
can ever increase the search space, means that {{katex(body="M_{opt}")}} is
either increased or not affected by any given constraint.

## Thread-local systems

Some systems may require being executed on the thread that defined them, due to
some of the system's internal data being thread-local (in Rust terms, `!Send`
and/or `!Sync`, depending on mutability of systems in a given implementation).

This requirement does not forbid parallelization: thread-agnostic systems (or
even systems local to different threads) may still run in parallel on other
threads.

While scheduling thread-local systems, it is only necessary to consider them in
the context of their threads - an obvious constraint.
The makespan of a program containing such systems has an additional lower
bound - it cannot be less than the greatest sum of execution time of systems
local to one thread:
{% katex(block=true) %}
    M_{opt} \ge \max_{T_i \in P}(\sum_{s_j \in T_i} t_j),
{% end %}
where {{katex(body="T_i")}} is a set of all {{katex(body="s \in P")}} local to
thread {{katex(body="i")}}.

## Thread-local data

Some of the data managed by the ECS may only be accessed by its defining thread
(`!Sync` for strictly immutable data, otherwise  `!Send`).
This case is similar to thread-local systems, differing in one key way:
the thread-local data can be shared between several systems.

However, it's impossible to run those systems in parallel: since such data can
be accessed from only one thread, and a thread can run only one system
at a time, only one system can be using the data at any given time.
Therefore, all systems that access thread-local data are effectively
thread-local systems.

Systems that access thread-local data that belongs to several different threads
are impossible to execute, and {{katex(body="P \notin \Pi")}} for
any {{katex(body="P")}} that contains such systems.

## Modifying data access

Some operations performed by a system may modify the entirety of shared data
in such a way that any active views into it will become invalid, e.g. inserting
new entities or deleting entities - this modifies the collection of entities,
which is not correct to do while the collection is being iterated (which
is the most common access pattern in ECS).
Such operations will be referred to as modifying, and systems that perform
modifying operations will be referred to as modifying systems.

One way to address the modifying systems is to give any such system exclusive
access to entirety of shared data (i.e., `&mut World`), forbidding it to run
concurrently with any other system.
A {{katex(body="stat")}} would then place that system into its own
exclusive {{katex(body="\sigma")}};
a {{katex(body="dyn")}} would have to effectively introduce an implicit
synchronisation point.
This is not the same as splitting {{katex(body="P")}} in two: the algorithm is
still free to place any systems before or after the modifying one, while
splitting would constrain all systems to their respective half.

Alternatively, modifying operations could be cached and performed at the end
of schedule, when it's guaranteed that no systems are running.
Unlike the one described earlier, this approach gives an important property
to the operations: they will happen deterministically, at an obvious
point in the schedule.

## Stages

Certain (common in practice) ECS programs can be uniquely split into
sub-programs, here referred to as stages: all systems of a stage have to be
executed before any systems of a subsequent stage.

To schedule any such program a {{katex(body="sched")}} only needs to consider
each individual stage on its own, greatly reducing the search space.
Each stage is, effectively, an individual ECS program.

Stages pair well with caching modifying operations: end of a stage can be used
to apply the operations, allowing the next stage to, for example, access new
entities created by the previous one.

## Explicit execution order

In some cases it's necessary to have an explicit execution order between two
individual systems.
A system might be processing events generated in another system - not ensuring
that the consumer runs after the producer may lead to one frame of delay in the
event resolution; if there's a whole chain of systems depending on each other's
output, the worst case for the delay will be as many frames as there are systems
in said chain.

A {{katex(body="stat")}} can address ordering by sorting a dependent system into
a {{katex(body="\sigma")}} that is executed after those containing its
dependencies.

A {{katex(body="dyn")}} would start only the systems that have all their
dependencies satisfied.
It could maintain a list of such systems, updating that whenever a system with
dependents finishes; or, it could make the systems wait until they've received
an amount of signals equal to the number of their dependencies, with every
system that finishes signalling its dependents.

Stages can be leveraged here, too: much like {{katex(body="stat")}} does
automatically, the user could insert a dependent system into a previous stage.
This, however, is a stronger constraint, as it effectively introduces explicit
execution order between the dependent and all systems of subsequent stages.

## Implicit execution order

Another order-related constraint can be sourced not from the properties of a
given {{katex(body="P")}}, but, rather, those of the API of the ECS library:
when populating a schedule, systems are necessarily inserted in a sequence
(whether explicitly or effectively, when gathering them from all sources into a
single collection), and it could be quite intuitive if execution order reflected
the insertion order.

However, such implicit ordering would remove any and all parallel execution of
systems, unless {{katex(body="sched")}} makes some sort of order-relaxing
assumptions.
For example, disjoint systems could be assumed to also be disjoint logically,
i.e. systems acting on non-related data are assumed to implement non-related
behaviors and thus don't have any implicit ordering between them.

Naturally, any order relaxing a {{katex(body="sched")}} would do should be
overridden by a conflicting explicit order constraint.
Inversely, there should be an "escape hatch" that lets users mark pairs of
systems as independent, regardless of their accessed data, allowing the
algorithm to schedule them in whatever order.

# Scheduler examples

While concrete parts of scheduling algorithms were hinted at throughout the
article, a couple of examples should provide a more complete the picture.

Here, algorithms of two crates (libraries) from the Rust ecosystem will serve as
that: [`bevy_ecs`], part of the [Bevy] engine, and [`yaks`], developed by the
author.
They are both built on top of the [`hecs`] ECS library, which is archetypal.

[`bevy_ecs`]: https://docs.rs/bevy_ecs/
[Bevy]: https://bevyengine.org/
[`yaks`]: https://docs.rs/yaks/
[`hecs`]: https://docs.rs/hecs/

## `bevy_ecs`

The scheduler provided by `bevy_ecs` is what ties all parts of Bevy together:
it invokes any and all code (written in the form of systems) both the engine and
the application built with it contain. In addition to owning all the systems,
this ECS also owns all of the data - both components and resources (data not
associated with an entity).

It employs stages, with modifying operations generally deferred until the end of
a stage via the `Commands` resource.

In addition to its scheduled closure, each system also has a "thread-local"
closure which can be executed "immediately", at any point in the stage, or "at
next flush", which happens at the end of stage.
Immediate execution implements thread locality (and enables modification at any
point within the stage), and next flush execution is used solely to apply the
deferred modifying operations.

Execution order within a stage is inferred from insertion order and data access,
with a previously inserted intersecting system assumed to be a dependency of
later one; i.e.:
* Systems reading from a location are executed strictly after previously
inserted systems writing to the same location.
* Systems writing to a location are executed strictly after previously inserted
systems reading from or writing to the same location.

As of writing, there is no way to specify explicit dependencies, or relax the
implicit ones.

The scheduling algorithm performs the following steps for each stage:
1. If the schedule has been changed, reset cached scheduling data (dependency
counters, list of thread-local systems).
2. From all systems of the stage, in order of insertion, select the range of
systems to operate on this cycle: from the end of last cycle's range, exclusive,
(or first system, inclusive, if this is the first cycle) to next thread-local
system (or last system if there are no thread-local systems), inclusive.
3. If the schedule or world's archetypes have been changed, update systems'
affected archetypes, recalculate dependencies, reset dependency counters, and
rebuild execution order, for all thread-agnostic systems in the selected range.
4. If it hasn't been done yet as part of step 3, reset dependency counters for
all thread-agnostic systems in the range.
5. Start every thread-agnostic system in the range by spawning a task that will
await its dependencies counter reaching zero, execute the system, and signal its
dependents' counters to decrement upon completion.
6. If the selected range contains a thread-local system, execute it on the main
thread with exclusive access to all data, then continue from step 2.
7. Execute all systems' modification closures on the main thread, in order of
insertion, with exclusive access to all data.

More details:
* The process is asynchronous: the coordinating task is non-blocking, allowing
the scheduler to work as expected even in setups without multiple threads.
* The library tracks if changes are made to the data it manages, enabling
implementing, for example, a system that performs its action only on entities
who had a specific component of theirs modified this frame.
The tracking is reset at the end of frame; there are plans to implement
multi-frame tracking as well. 
* All stages seem to be rebuilt on any change to the schedule, even if it would
not affect them.

## `yaks`

The scheduler of `yaks` is meant to be maximally composable, with other
instances of itself and the surrounding application.
To that end, neither components nor resources are owned by any abstraction
provided by the crate, instead both are borrowed by the `Executor` (the
scheduler abstraction) for the duration of schedule execution.
Systems are implemented in a way that allows them to be easily used as plain
functions elsewhere in the application.

There are no stages, instead users are encouraged to create several executors
and invoke them in a sequence.
Built-in abstraction for deferring modifying operations is not provided, in
favor of having users implement one, tailored to their use case.
Thread-local systems are not addressed.

Execution order between two systems is specified by giving a tag (an arbitrary
type implementing `Sized + Eq + Hash + Debug`) to the first system when
inserting it, and providing a vector containing said tag when inserting the
second system.
No implicit dependencies are inferred.

As of writing, the executor has two distinct "modes", selected automatically
during its initialization.
The first, "dispatching", is a heuristic used when all systems are
statically disjoint (i.e., will never intersect during the entirety of
executor lifetime) - it bypasses scheduling algorithm and instead starts
all of the systems at the same time, without any additional checks.

The second, "scheduling", is used in all other cases:
1. Queue systems that don't have any dependencies to run by putting their
IDs into the list of queued systems.
2. Reset every system's unsatisfied dependencies counter.
If world's archetypes have been changed, the system's affected archetypes are
updated here as well.
3. If there are no queued systems and no running systems, exit the algorithm.
4. For every queued system, if it is disjoint with already running systems,
add its ID to the list of running systems, and start it by spawning into the
thread pool a closure that'll execute the system and signal the executor with
the system's ID upon completion.
5. Remove IDs of running systems from list of queued systems. 
6. Wait for at least one signal containing a finished system's ID, storing it
in a list of just finished systems.
7. Collect IDs of any other system that may have finished into same list.
8. For all systems from the just finished list, collect IDs of their
dependents into a list.
9. Decrement unsatisfied dependencies count of the dependents, once per mention
in the list from step 8.
If the count is zero, queue the dependent to run.
10. Sort the list of queued systems in order of decreasing amount of dependents.
11. Continue from step 3.

More details:
- All lists mentioned are held onto by the executor, to avoid extra allocations.
- List of systems with no dependencies is populated once, during executor
initialization, and is sorted in order of decreasing amount of dependents.
- The algorithm requires at least two threads, with one being reserved for
coordinating however many worker threads (this will probably change when the
library moves from [`rayon`] to something like [`switchyard`], enabling
the use of non-blocking synchronization primitives).

[`rayon`]: https://docs.rs/rayon/
[`switchyard`]: https://docs.rs/switchyard/

# Final thoughts

Multiprocessor scheduling problem has numerous related works to draw ideas from
in search of solutions to this subset of it - a potential topic for the possible
part two.
Others are new algorithms, either from other crates or developed independently,
and API design of the scheduler abstraction.

One of the main reasons for this article's existence is serving as a starting
point for the [new Bevy scheduler proposal][proposal], and most of immediate
new work will likely be happening around it.

[proposal]: /draft/bevy-proposal

Since this is a simple static site, discussion of the article is deferred to
relevant [github PR](TODO).
Alternatively, refer to contact information on the [main page](/).

