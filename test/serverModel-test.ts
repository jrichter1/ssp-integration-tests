import * as chai from 'chai';
import { RSPClient, Protocol } from 'rsp-client';
import * as server from '../resources/server-util';
import * as path from 'path';
import 'mocha';

const expect = chai.expect;

describe('Server Model', () => {

    let client: RSPClient;
    let port: number;

    const wildflyRoot = path.resolve('./wildfly');

    before(function(done) {
        this.timeout(300000);
        server.clearData();
        server.download()
        .then(() => { return server.getWildfly(); })
        .then(() => { return server.start(); })
        .then(async (result) => {
            port = result;
            client = new RSPClient('localhost', port);
            await client.connect();
            done();
        });
    });

    after(() => {
        client.disconnect();
        server.stop();
        server.clearData();
    });

    it('wildfly servers should be supported', async () => {
        const serverTypes = await client.getServerTypes();
        
        expect(serverTypes).deep.include({ id: 'org.jboss.ide.eclipse.as.wildfly.100',
        visibleName: 'WildFly 10.x',
        description: 'A server adapter capable of discovering and controlling a WildFly 10.x runtime instance.' });
        expect(serverTypes).deep.include({ id: 'org.jboss.ide.eclipse.as.wildfly.110',
        visibleName: 'WildFly 11.x',
        description: 'A server adapter capable of discovering and controlling a WildFly 11.x runtime instance.' });
        expect(serverTypes).deep.include({ id: 'org.jboss.ide.eclipse.as.wildfly.120',
        visibleName: 'WildFly 12.x',
        description: 'A server adapter capable of discovering and controlling a WildFly 12.x runtime instance.' });
        expect(serverTypes).deep.include({ id: 'org.jboss.ide.eclipse.as.wildfly.130',
        visibleName: 'WildFly 13.x',
        description: 'A server adapter capable of discovering and controlling a WildFly 13.x runtime instance.' });
    });

    it('EAP servers should be supported', async () => {
        const serverTypes = await client.getServerTypes();

        expect(serverTypes).deep.include({ id: 'org.jboss.ide.eclipse.as.eap.60',
        visibleName: 'JBoss EAP 6.0',
        description: 'A server adapter capable of discovering and controlling a JBoss EAP 6.0 runtime instance.' });
        expect(serverTypes).deep.include({ id: 'org.jboss.ide.eclipse.as.eap.61',
        visibleName: 'JBoss EAP 6.1',
        description: 'A server adapter capable of discovering and controlling a JBoss EAP 6.1 runtime instance.' });
        expect(serverTypes).deep.include({ id: 'org.jboss.ide.eclipse.as.eap.70',
        visibleName: 'JBoss EAP 7.0',
        description: 'A server adapter capable of discovering and controlling a JBoss EAP 7.0 runtime instance.' });
        expect(serverTypes).deep.include({ id: 'org.jboss.ide.eclipse.as.eap.71',
        visibleName: 'JBoss EAP 7.1',
        description: 'A server adapter capable of discovering and controlling a JBoss EAP 7.1 runtime instance.' });
    });

    it('Minishift should be supported', async () => {
        const serverTypes = await client.getServerTypes();

        expect(serverTypes).deep.include({ id: 'org.jboss.tools.openshift.cdk.server.type.minishift.v1_12',
        visibleName: 'Minishift 1.12+',
        description: 'A server adapter capable of controlling a Minishift 1.12+ runtime instance.' });
    });

    it('getRequiredAttributes returns required attributes for a valid server type', async () => {
        const type: Protocol.ServerType = {
            id: 'org.jboss.ide.eclipse.as.wildfly.130',
            description: 'A server adapter capable of discovering and controlling a WildFly 13.x runtime instance.',
            visibleName: 'WildFly 13.x'
        };

        const attrs = await client.getServerTypeRequiredAttributes(type);
        expect(attrs).deep.equals(
            { attributes: { 'server.home.dir': {
                type: 'string',
                description: 'A filesystem path pointing to a server installation\'s root directory' }
            } });
    });

    it('getRequiredAttributes handles unsupported types', async () => {
        const type: Protocol.ServerType = {
            id: 'foo',
            description: 'bar',
            visibleName: 'baz'
        };

        const attrs = await client.getServerTypeRequiredAttributes(type);
        expect(attrs).equals(null);
    });

    it('getRequiredAttributes handles null values', async () => {
        const attrs = await client.getServerTypeRequiredAttributes(null);
        expect(attrs).equals(null);
    });

    it('getOptionalAttributes returns required attributes for a valid server type', async () => {
        const type: Protocol.ServerType = {
            id: 'org.jboss.ide.eclipse.as.wildfly.130',
            description: 'A server adapter capable of discovering and controlling a WildFly 13.x runtime instance.',
            visibleName: 'WildFly 13.x'
        };

        const attrs = await client.getServerTypeOptionalAttributes(type);
        expect(attrs).deep.equals(
            { attributes: { "vm.install.path": {
                description: "A string representation pointing to a java home. If not set, java.home will be used instead.",
                type: 'string' } 
            }});
    });

    it('getOptionalAttributes handles unsupported types', async () => {
        const type: Protocol.ServerType = {
            id: 'foo',
            description: 'bar',
            visibleName: 'baz'
        };

        const attrs = await client.getServerTypeOptionalAttributes(type);
        expect(attrs).equals(null);
    });

    it('getOptionalAttributes handles null values', async () => {
        const attrs = await client.getServerTypeOptionalAttributes(null);
        expect(attrs).equals(null);
    });

    it('createServer creates a server given valid parameters', async () => {      
        await client.createServerSync(wildflyRoot, 'fly');

        const handles = await client.getServerHandles();
        await client.deleteServerSync(handles[0]);

        expect(handles).deep.include({ id: 'fly',
        type: 
         { id: 'org.jboss.ide.eclipse.as.wildfly.130',
           visibleName: 'WildFly 13.x',
           description: 'A server adapter capable of discovering and controlling a WildFly 13.x runtime instance.' } });
    });

    it('createServer handles unknown server/bean', async () => {
        const beans = await client.findServerBeans(path.resolve('.'));
        const status = await client.createServerAsync(beans[0]);

        expect(status.severity).greaterThan(0);
        expect(status.message).contain('Parameter is invalid.');
    });

    it('createServer handles non-unique server ids', async () => {
        const beans = await client.findServerBeans(wildflyRoot);
        const handle = await client.createServerSync(wildflyRoot, 'fly');

        const status = await client.createServerAsync(beans[0], 'fly');
        await client.deleteServerSync(handle);
       
        expect(status.severity).greaterThan(0);
    });

    it('deleteServer deletes an existing server', async () => {
        const handle = await client.createServerSync(wildflyRoot, 'fly');
        await client.deleteServerSync(handle);

        const handles = await client.getServerHandles();
        expect(handles).not.deep.include(handle);
    });

    it('deleteServer should handle deleting a non existing server', async () => {
        const handle = await client.createServerSync(wildflyRoot, 'fly');
        await client.deleteServerSync(handle);

        const status = await client.deleteServerAsync(handle);
        expect(status.severity).greaterThan(0);
        expect(status.message).equals(`Server not removed: ${handle.id}`);
    });

    it('deleteServer should handle an invalid server handle', async () => {
        let handle: Protocol.ServerHandle = {
            id: 'foo',
            type: {
                description: 'foo',
                id: 'foo',
                visibleName: 'foo'
            }
        };
        const status = await client.deleteServerAsync(handle);

        expect(status.severity).greaterThan(0);
        expect(status.message).equals(`Server not removed: ${handle.id}`);
    });

    it('deleteServer should handle a null server handle', async () => {
        const status = await client.deleteServerAsync(null);

        expect(status.severity).greaterThan(0);
        expect(status.message).not.equal('ok');
    });

    it('getServerHandles returns all server handles', async () => {
        const handle1 = await client.createServerSync(wildflyRoot, 'fly');
        const handle2 = await client.createServerSync(wildflyRoot, 'wfly');

        const handles = await client.getServerHandles();
        await client.deleteServerSync(handle1);
        await client.deleteServerSync(handle2);

        expect(handles).deep.include(handle1);
        expect(handles).deep.include(handle2);
    });
});
