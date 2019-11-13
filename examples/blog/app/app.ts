import { createApp } from 'pumpkins'
import myplugin from './myplugin'

createApp()
  .use(myplugin)
  .startServer()
