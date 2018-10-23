# Docker Craft

## Requirements

- Docker
- npm 
- node
- yarn

## Getting Started

1. `docker-compose up`
2. `yarn install`
3. `npm start`

## Shutting down

`docker-compose down`

## View the site at:

`http://localhost:5000`

## View the admin at:

`http://localhost:8080/admin`

## Deploying to Elastic Beanstalk

1. set up elastic bleanstalk application by running `eb init [--proifle <profile>]`
2. create a elastic beanstalk application by running `eb create [--proifle <profile>]`
3. Set the document root to `code/public` from the aws management console
1. `npm run deploy`

## importing a dabasebase dump

In order to import a database dump locally, have the dump file in `/tmp/db.sql` and then remove 
the data volume as the database is only imported if it dosen't already exist.  
Then run `docker-compose up`.