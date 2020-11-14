+++
title = "Bevy scheduler proposal"
date = 2020-11-13
+++

1. Stages should be used to express execution order between groups
of systems, not individual systems.
2. There should be a mechanism to express optional execution order between
individual systems in a stage.
3. Systems within a stage should be allowed to run opportunistically, i.e.,
whenever there are available resources (borrows and a thread) and no
unsatisfied execution order dependencies.