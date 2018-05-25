import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { BluetoothSerial } from '@ionic-native/bluetooth-serial';
import { ScreenOrientation } from '@ionic-native/screen-orientation';
import { ChangeDetectorRef } from '@angular/core';
import { AlertController } from 'ionic-angular';
import * as nipplejs from 'nipplejs';

@Component({
    selector: 'page-home',
    templateUrl: 'home.html'
})

export class HomePage {
    
    private joystick;
    private macAddress;
    private dispCon;
    private byte;
    private buzzerActive;
    private angle;
    private angleOld;
    private sendingByte;
    private rx;

    constructor(public navCtrl: NavController, public bluetoothSerial: BluetoothSerial, public screenOrientation: ScreenOrientation, private alertCtrl: AlertController, private cdRef: ChangeDetectorRef) {
        this.bluetoothSerial.enable();
        this.dispCon = 'Não conectado!';
        this.macAddress = '';
        this.byte = new Uint8Array(8);
        this.sendingByte = new Uint8Array(8)
        this.angleOld = -1;
        this.angle = -2;
        this.buzzerActive = false;
        this.screenOrientation.lock(this.screenOrientation.ORIENTATIONS.LANDSCAPE);
        this.rx = null;
    }

    /*  Ao terminar de carregar, cria o joystick e o associa às suas funções    */
    ionViewDidLoad() {
        var parent = this;
        var options = {
            zone: document.querySelector('.zone.static'),
            mode: 'static',
            position: {
                left: '50%',
                top: '50%'
            },
            color: 'blue',
            size: 200
        };
        
        setTimeout(function() {
            parent.joystick = nipplejs.create(options);
            parent.bindNipple();    
        }, 500);
    }
    
 

    /*  Exibe um painel para seleção do dispositivo bluetooth ao qual o usuário deseja se conectar  */
    presentConfirm() {
        var options = {
            title: 'Bluetooth',
            inputs: []
        }
        
        this.bluetoothSerial.list().then((devices)=>{
            for(var i = 0; i < devices.length; i++) {
                options.inputs.push({
                    name: 'options',
                    value: devices[i].id,
                    label: devices[i].name + ' [' + devices[i].id + ']',
                    type: 'radio',
                    checked: (devices[i].id == this.macAddress),
                    handler: dados => {
                        this.dispCon = dados.label;
                        this.macAddress = dados.value;
                        this.bluetoothSerial.connect(this.macAddress).subscribe(() => {
                            this.rx = 'con1';
                            this.bluetoothSerial.subscribeRawData().subscribe(() => {
                                this.rx = 'con2';
                                this.cdRef.detectChanges();
                                this.bluetoothSerial.read().then((buffer) => {
                                    this.rx = 'con3';
                                    this.rx = new Uint8Array(buffer);
                                    this.cdRef.detectChanges();
                                });
                            });
                        }, (err) => {
                            this.dispCon = 'Não conectado!';
                            this.rx = 'erro';
                        });
                        alert.dismiss();
                    }
                });
            }
            
            var alert = this.alertCtrl.create(options);
            alert.present();
            
        }, (error)=>{this.alertCtrl.create({title:'Não há dispositivos pareados!'}).present()});
    }
    
    /*  Contém o comportamento do aplicativo dependendo do que o usuário fizer com o joystick*/
    public bindNipple() {
        var parent = this;
        this.joystick.on('end', function(evt, data) {
            parent.paraMotor();
        }).on('move', function(evt, data) {
            var aux1 = Math.round(parent.angleOld / 90);
            var aux2 = Math.round(parent.angle / 90);
            parent.angleOld = parent.angle;
            parent.angle = data.angle.degree;
            if(aux1 === aux2 || (Math.abs(aux1 - aux2) === 4)) return;
            parent.montaByte();
        });
    }
    
    /*  Ativa um bit representando a buzina ativa   */
    public buzzer() {
        if(this.buzzerActive) return;
        this.buzzerActive = true;
        this.montaByte();
        var parent = this;
        setTimeout(function() {
            parent.buzzerActive = false;
            parent.montaByte();
        }, 500);
    }
    
    /*  Monta o byte a ser enviado para o PIC com base no ângulo do joystick e no bit da buzina */
    public montaByte() {
        if(this.angle > 45 && this.angle <= 135) { 
            // Anda para frente
            this.byte[0] = 8 + 2;
        } else if(this.angle > 135 && this.angle <= 225) {
            // Gira no próprio eixo em sentido anti-horário
            this.byte[0] = 8 + 1;
        } else if(this.angle > 225 && this.angle <= 315) {
            // Anda para trás;
            this.byte[0] = 4 + 1;
        } else if(this.angle > 315 && this.angle <= 360 || this.angle > 0 && this.angle <= 45) {
            // Gira no próprio eixo em sentido horário
            this.byte[0] = 4 + 2;
        }
        
        this.sendingByte[0] = this.buzzerActive ? this.byte[0] + 16 : this.byte[0];
//        console.log(this.dec2bin(sendingByte[0]));
//        this.angle = -1;
        this.sendByte();
    }
    
    /*  Envia um comando para parar o motor */
    public paraMotor() {
        if(this.byte[0] === 32) return;
        this.byte[0] = 32;
        this.angle = 900;
        this.montaByte();
    }
    
    /*  Função criada apenas para depuração. Converte um número decimal em binário  */
    public dec2bin(dec){
        return (dec >>> 0).toString(2);
    }
    
    /*  Envia o byte ao PIC */
    public sendByte() {
        var parent = this;
        this.bluetoothSerial.write(this.sendingByte).then((success)=>{
//            alert('Byte enviado com sucesso!');
        }, (err)=>{
//            alert('Erro ao enviar byte!');
            parent.rx = 'erro';
        });
    }
    
}
