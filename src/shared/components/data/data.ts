import { h } from 'vue'

import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  CircleCheck,
  Circle,
  CircleX,
  CircleQuestionMark,
  Timer,
} from 'lucide-vue-next'

export const labels = [
  {
    value: 'bug',
    label: 'Bug',
  },
  {
    value: 'feature',
    label: 'Feature',
  },
  {
    value: 'documentation',
    label: 'Documentation',
  },
]

export const statuses = [
  {
    value: 'backlog',
    label: 'Backlog',
    icon: h(CircleQuestionMark),
  },
  {
    value: 'todo',
    label: 'Todo',
    icon: h(Circle),
  },
  {
    value: 'in progress',
    label: 'In Progress',
    icon: h(Timer),
  },
  {
    value: 'done',
    label: 'Done',
    icon: h(CircleCheck),
  },
  {
    value: 'canceled',
    label: 'Canceled',
    icon: h(CircleX),
  },
]

export const priorities = [
  {
    value: 'low',
    label: 'Low',
    icon: h(ArrowDown),
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: h(ArrowRight),
  },
  {
    value: 'high',
    label: 'High',
    icon: h(ArrowUp),
  },
]
