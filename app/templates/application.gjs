import { pageTitle } from 'ember-page-title';
import { LinkTo } from '@ember/routing';
import Soroban from 'soroban-trainer/components/soroban';

<template>
  {{pageTitle "Soroban Trainer"}}

  <div class="app-shell">
    <header class="app-header">
      <LinkTo @route="index" class="brand">🧮 Soroban Trainer</LinkTo>
      <nav>
        <LinkTo @route="index">Home</LinkTo>
        <LinkTo @route="assessment">Placement</LinkTo>
      </nav>
    </header>
    <main class="app-main">
      {{outlet}}
    </main>
  </div>

  <Soroban />
</template>
