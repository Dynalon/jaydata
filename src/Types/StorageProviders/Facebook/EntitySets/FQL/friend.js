import $data, { $C, Guard, Container, Exception, MemberDefinition } from 'jaydata-core';


$data.Class.define("$data.Facebook.types.FbFriend", $data.Entity, null, {
    uid1: { type: "number", key: true, searchable: true },
    uid2: { type: "number", key: true, searchable: true }
}, null);
