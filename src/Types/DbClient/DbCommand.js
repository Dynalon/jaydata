import $data, { $C, Guard, Container, Exception, MemberDefinition } from 'jaydata-core';

$data.Class.define('$data.dbClient.DbCommand', null, null,
{
    connection: {},
    parameters: {},
    execute: function (callback) {
        Guard.raise("Pure class");
    }
}, null);
