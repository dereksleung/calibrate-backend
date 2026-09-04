#!/bin/bash
git remote remove no-mistakes 
no-mistakes init
export NO_MISTAKES_TELEMETRY=off
no-mistakes daemon start