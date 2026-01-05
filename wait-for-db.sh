#!/bin/sh
# wait-for-db.sh - Wait for MySQL to be ready

set -e

host="$1"
shift
cmd="$@"

until nc -z -v -w30 "$host" 3306; do
  echo "Waiting for database connection at $host:3306..."
  sleep 2
done

echo "Database is up - executing command"
exec $cmd
