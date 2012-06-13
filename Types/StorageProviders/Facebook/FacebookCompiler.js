
//"use strict";	// suspicious code

$C('$data.storageProviders.Facebook.FacebookCompiler', $data.Expressions.EntityExpressionVisitor, null, {
    constructor: function () {
        this.provider = {};
    },

    compile: function (query) {
        this.provider = query.entitySet.entityContext.storageProvider;

        var context = {
            filterSql: { sql: '' },
            projectionSql: { sql: '' },
            orderSql: { sql: '' },
            skipSql: { sql: '' },
            takeSql: { sql: '' },
            tableName: ''
        };
        this.Visit(query.expression, context);

        var autoGeneratedSelect = false;
        if (!context.projectionSql.sql) {
            context.projectionSql = this.autoGenerateProjection(query);
            autoGeneratedSelect = true;
        }

        if (context.filterSql.sql == '')
            Guard.raise(new Exception('Filter/where statement is required', 'invalid operation'));

        return {
            queryText: context.projectionSql.sql + ' FROM ' + context.tableName +
                context.filterSql.sql +
                context.orderSql.sql +
                context.takeSql.sql +
                (context.takeSql.sql ? context.skipSql.sql : ''),
            selectMapping: autoGeneratedSelect == false ? context.projectionSql.selectFields : null,
            params: []
        };

    },

    autoGenerateProjection: function (query) {
        var newQueryable = new $data.Queryable(query.context);
        newQueryable._checkRootExpression(query.entitySet);
        var codeExpression = Container.createCodeExpression(this.generateProjectionFunc(query));
        var exp = Container.createProjectionExpression(newQueryable.expression, codeExpression);
        var q = Container.createQueryable(newQueryable, exp);

        var expression = q.expression;
        var preparator = Container.createQueryExpressionCreator(query.entitySet.entityContext);
        expression = preparator.Visit(expression);

        var databaseQuery = {
            projectionSql: { sql: '' }
        };
        this.Visit(expression, databaseQuery);

        return databaseQuery.projectionSql;
    },
    generateProjectionFunc: function (query) {
        var isAuthenticated = this.provider.AuthenticationProvider.Authenticated;
        var publicMemberDefinitions = query.entitySet.createNew.memberDefinitions.getPublicMappedProperties();
        if (!isAuthenticated && publicMemberDefinitions.some(function (memDef) { return memDef.isPublic == true; })) {
            publicMemberDefinitions = publicMemberDefinitions.filter(function (memDef) { return memDef.isPublic == true; });
        }

        var selectStr = 'function (s){ return {';
        publicMemberDefinitions.forEach(function (memDef, i) {
            if (i != 0) selectStr += ', ';
            selectStr += memDef.name + ': s.' + memDef.name;
        });
        selectStr += '};';

        //var projectionFunc = null;
        //eval(selectStr);
        return selectStr;
    },

    VisitFilterExpression: function (expression, context) {
        ///<param name="expression" type="$data.Expressions.FilterExpression" />
        this.Visit(expression.source, context);

        context.filterSql.type = expression.nodeType;
        if (context.filterSql.sql == '')
            context.filterSql.sql = ' WHERE ';
        else
            context.filterSql.sql += ' AND ';

        this.Visit(expression.selector, context.filterSql);
    },
    VisitProjectionExpression: function (expression, context) {
        ///<param name="expression" type="$data.Expressions.ProjectionExpression" />
        this.Visit(expression.source, context);

        context.projectionSql.type = expression.nodeType;
        if (context.projectionSql.sql == '')
            context.projectionSql.sql = 'SELECT ';
        else
            Guard.raise(new Exception('Multiple select error'));

        this.Visit(expression.selector, context.projectionSql);
    },
    VisitOrderExpression: function (expression, context) {
        ///<param name="expression" type="$data.Expressions.OrderExpression" />
        this.Visit(expression.source, context);

        context.orderSql.type = expression.nodeType;
        if (context.orderSql.sql == '')
            context.orderSql.sql = ' ORDER BY ';
        else
            Guard.raise(new Exception('Multiple sorting not supported', 'not supported'));

        this.Visit(expression.selector, context.orderSql);
        context.orderSql.sql += expression.nodeType == ExpressionType.OrderByDescending ? " DESC" : " ASC";
    },
    VisitPagingExpression: function (expression, context) {
        ///<param name="expression" type="$data.Expressions.PagingExpression" />
        this.Visit(expression.source, context);

        if (expression.nodeType == ExpressionType.Skip) {
            context.skipSql.type = expression.nodeType;
            context.skipSql.sql = ' OFFSET ';
            this.Visit(expression.amount, context.skipSql);
        }
        else if (expression.nodeType == ExpressionType.Take) {
            context.takeSql.type = expression.nodeType;
            context.takeSql.sql = ' LIMIT ';
            this.Visit(expression.amount, context.takeSql);
        }
    },

    VisitSimpleBinaryExpression: function (expression, context) {
        context.sql += "(";
        var left = this.Visit(expression.left, context);
        context.sql += expression.resolution.mapTo;

        if (expression.resolution.resolvableType &&
            !Guard.requireType(expression.resolution.mapTo + ' expression.right.value', expression.right.value, expression.resolution.resolvableType)) {
                Guard.raise(new Exception(expression.right.type + " not allowed in '" + expression.resolution.mapTo + "' statement", "invalid operation"));
            }

        var right = this.Visit(expression.right, context);
        context.sql += ")";
    },

    VisitEntityFieldExpression: function (expression, context) {
        var source = this.Visit(expression.selector, context);
    },
    VisitMemberInfoExpression: function (expression, context) {
        var memberName = expression.memberName;
        context.sql += memberName;
        //context.fieldName = memberName;
        context.fieldData = { name: memberName, dataType: expression.memberDefinition.dataType };

        if (context.type == 'Projection' && !context.selectFields) {
            if (context.fieldOperation === true)
                context.selectFields = [{ from: 'anon' }];
            else
                context.selectFields = [{ from: memberName, dataType: expression.memberDefinition.dataType }];
        }
    },

    VisitConstantExpression: function (expression, context) {
        if (context.type == 'Projection')
            Guard.raise(new Exception('Constant value is not supported in Projection.', 'Not supported!'));

        this.VisitQueryParameterExpression(expression, context);
    },

    VisitQueryParameterExpression: function (expression, context) {
        var expressionValueType = Container.resolveType(Container.getTypeName(expression.value));
        if (this.provider.supportedDataTypes.indexOf(expressionValueType) != -1)
            context.sql += this.provider.fieldConverter.toDb[Container.resolveName(expressionValueType)](expression.value);
        else {
            switch (expressionValueType) {
                case $data.Queryable:
                    context.sql += '(' + expression.value.toTraceString().queryText + ')';
                    break;
                default:
                    context.sql += "" + expression.value + ""; break;
            }
        }
    },

    VisitParametricQueryExpression: function (expression, context) {
        var exp = this.Visit(expression.expression, context);
        context.parameters = expression.parameters;
    },

    VisitEntitySetExpression: function (expression, context) {
        context.tableName = expression.instance.tableName;
    },

    VisitObjectLiteralExpression: function (expression, context) {
        var self = this;
        context.selectFields = context.selectFields || [];
        expression.members.forEach(function (member) {
            if (member.expression instanceof $data.Expressions.ObjectLiteralExpression) {
                context.mappingPrefix = context.mappingPrefix || [];
                context.mappingPrefix.push(member.fieldName);
                self.Visit(member, context);
                context.mappingPrefix.pop();
            }
            else {
                if (context.selectFields.length > 0)
                    context.sql += ', ';

                self.Visit(member, context);
                var toProperty = context.mappingPrefix instanceof Array ? context.mappingPrefix.join('.') + '.' + member.fieldName : member.fieldName;
                context.selectFields.push({ from: context.fieldData.name, to: toProperty, dataType: context.fieldData.dataType });
            }
        });
    },
    VisitObjectFieldExpression: function (expression, context) {
        return this.Visit(expression.expression, context);
    },

    VisitEntityFieldOperationExpression: function (expression, context) {
        Guard.requireType("expression.operation", expression.operation, $data.Expressions.MemberInfoExpression);

        var opDef = expression.operation.memberDefinition;
        var opName = opDef.mapTo || opDef.name;

        context.sql += '(';

        if (opDef.expressionInParameter == false)
            this.Visit(expression.source, context);

        context.sql += opName;
        context.sql += "(";
        var paramCounter = 0;
        var params = opDef.parameters || [];

        var args = params.map(function (item, index) {
            var result = { dataType: item.dataType };
            if (item.value) {
                result.value = item.value;
            } else if (item.name === "@expression") {
                result.value = expression.source;
            } else {
                result.value = expression.parameters[paramCounter];
                result.itemType = expression.parameters[paramCounter++].type;
            };
            return result;
        });

        args.forEach(function (arg, index) {
            var itemType = arg.itemType ? Container.resolveType(arg.itemType) : null;
            if (!itemType || ((arg.dataType instanceof Array && arg.dataType.indexOf(itemType) != -1) || arg.dataType == itemType)) {
                if (index > 0) {
                    context.sql += ", ";
                };

                if (context.type == 'Projection')
                    context.fieldOperation = true;

                this.Visit(arg.value, context);

                if (context.type == 'Projection')
                    context.fieldOperation = undefined;

            } else
                Guard.raise(new Exception(parameter.type + " not allowed in '" + expression.operation.memberName + "' statement", "invalid operation"));
        }, this);

        if (context.fieldData && context.fieldData.name)
            context.fieldData.name = 'anon';

        if (opDef.rigthValue) context.sql += opDef.rigthValue;
        else context.sql += ")";

        context.sql += ')';
    }
}, null);

